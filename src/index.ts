import 'reflect-metadata'
import { Express } from './api/express.js'
import { Context } from './util/context.js'

import { MetadataController } from './metadata/metadata.controller.js'
import { LibraryController } from './library/library.controller.js'
import { RSSController } from './rss/rss.controller.js'
import { TorrentController } from './torrent/torrent.controller.js'
import Logger from './util/logger.js'
import deprecatedWarnings from './util/deprecatedWarnings.js'

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
		Logger.error(e)
		return gracefulClose()
	}

	try {
		await Context.library.init()
		await Context.metadata.refreshMetadata()
		await Context.torrent.startWatching()
	} catch (e) {
		Logger.error('APPLICATION CRASHED UNEXPECTEDLY...')
		Logger.error(e)
		gracefulClose()
	}
}
startApp()
