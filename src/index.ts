import 'reflect-metadata'
import { Express } from './api/express.js'
import { Context } from './util/context.js'

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
		Logger.info('STARTING APPLICATION...')

		Logger.info('INITIALIZING EXPRESS SERVER...')
		Context.express = new Express()
		await Context.express.start()

		Logger.info('APPLICATION STARTED SUCCESSFULLY...')
	} catch (e) {
		Logger.error('APPLICATION COULD NOT BE STARTED...')
		Logger.error(e)
		gracefulClose()
	}
}
startApp()
