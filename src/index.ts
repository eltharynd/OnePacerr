import 'reflect-metadata'
import { Express } from './api/express.js'
import { Context } from './util/context.js'

import { LibraryController } from './library/library.controller.js'
import { MetadataController } from './metadata/metadata.controller.js'
import { RSSController } from './rss/rss.controller.js'
import { LabelsDisabledInDelugeError } from './torrent/clients/deluge.controller.js'
import { TorrentController } from './torrent/torrent.controller.js'
import { TorrentConnectionError } from './torrent/torrent.model.js'
import deprecatedWarnings from './util/deprecated-warnings.js'
import { logErrorCause } from './util/format-connection-error.js'
import Logger from './util/logger.js'

const startApp = async () => {
	let gracefulClose = async () => {
		try {
			Logger.info('GRACEFULLY QUITTING APPLICATION...')

			//GRACEFUL QUIT HERE

			Logger.info('GRACEFULLY CLOSED APPLICATION...')
			process.exit(0)
		} catch (error) {
			Logger.error('COULD NOT GRACEFULLY CLOSE APPLICATION...')
			Logger.error(error)
		}
	}
	process.on('SIGINT', gracefulClose)
	process.on('SIGTERM', gracefulClose)

	try {
		Logger.info(`##################################`)
		Logger.info(`##################################`)
		Logger.info(`####                          ####`)
		Logger.info(
			`####     OnePacerr ${process.env.npm_package_version}      ####`,
		)
		Logger.info(`####                          ####`)
		Logger.info(`##################################`)
		Logger.info(`##################################`)
		Logger.info('')
		Logger.info('STARTING APPLICATION...')

		deprecatedWarnings()

		Logger.info('INITIALIZING EXPRESS SERVER...')
		Context.express = new Express()
		await Context.express.start()

		Context.metadata = new MetadataController()
		Context.rss = new RSSController()
		Context.library = new LibraryController()
		Context.torrent = new TorrentController()

		Logger.info('APPLICATION STARTED SUCCESSFULLY...')
	} catch (e) {
		Logger.error('APPLICATION COULD NOT BE STARTED...')
		Logger.error(e instanceof Error ? e.message : e)
		logErrorCause(e)
		return gracefulClose()
	}

	try {
		await Context.library.init()
		await Context.metadata.refreshMetadata()
		await Context.torrent.startWatching()
	} catch (e) {
		if (
			e instanceof LabelsDisabledInDelugeError ||
			e instanceof TorrentConnectionError
		) {
			Logger.debug(`Error handled, no need to crash...`)
		} else {
			Logger.error('APPLICATION CRASHED UNEXPECTEDLY...')
			Logger.error(e instanceof Error ? e.message : e)
			logErrorCause(e)
			gracefulClose()
		}
	}
}
startApp()
