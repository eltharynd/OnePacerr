import 'reflect-metadata'
import { Express } from './api/express.js'
import environment from './environment.js'
import { Context } from './util/context.js'
import { KeycloakManager } from './keycloak/keycloak.manager.js'
import Logger from './util/logger.js'

const startApp = async () => {
	let expirationInterval

	if (!environment.PRIVATE_KEY || !environment.PUBLIC_KEY) {
		Logger.error(
			`Couldn't load RSA key pair... Make sure you setup the project correctly...`,
		)
		return process.exit(-1)
	}

	let gracefulClose = async () => {
		try {
			Logger.info('GRACEFULLY QUITTING APPLICATION...')

			//CLOSE COMPONENTS GRACEFULLY HERE
			if (expirationInterval) {
				clearInterval(expirationInterval)
				expirationInterval = null
			}

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

		Logger.info('TRYING INITIALIZE KEYCLOAK...')
		try {
			Context.keycloak = new KeycloakManager()
			await Context.keycloak.initialize()
			expirationInterval = setInterval(async () => {
				try {
					await Context.keycloak.processExpirations()
				} catch (e) {
					Logger.error('FAILED TO EXPIRE USERS...')
					throw e
				}
			}, environment.AUTO_EXPIRATION_INTERVAL)
		} catch (e) {
			Logger.error('FAILED TO INITIALIZE KEYCLOAK...')
			if (!environment.LOCAL_DEV) throw e
		}
	} catch (e) {
		Logger.error('APPLICATION COULD NOT BE STARTED...')
		Logger.error(e)
		gracefulClose()
	}
}
startApp()
