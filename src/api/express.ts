import express from 'express'
import { Logger } from 'ez-ts-logger'
import { Server, createServer } from 'node:http'
import { createExpressServer } from 'routing-controllers'
import environment from '../environment.js'
import { HealthController } from './health/health.controller.js'
import { DefaultInterceptor } from './interceptors/default.interceptor.js'
import { HttpErrorHandler } from './middlewares/error.middleware.js'
import { LoggerMiddleware } from './middlewares/logger.middleware.js'
import { StatusController } from './status/status.controller.js'

export class Express {
	origins = ['*']

	app: express.Express
	server: Server

	constructor() {
		this.app = createExpressServer({
			cors: {
				origin: this.origins,
				optionsSuccessStatus: 200,
				credentials: true,
			},
			routePrefix: environment.API_BASE.replace(/\/$/, ''),
			defaultErrorHandler: false,
			middlewares: [LoggerMiddleware, HttpErrorHandler],
			controllers: [HealthController, StatusController],
			interceptors: [DefaultInterceptor],
			validation: { whitelist: true },
			classToPlainTransformOptions: {
				enableCircularCheck: true,
			},
		})

		this.app.set('trust proxy', true)
		this.server = createServer(this.app)
	}

	async start(portOverride?: number): Promise<Server> {
		return new Promise<Server>((resolve, reject) => {
			this.server.listen(portOverride || environment.PORT)
			this.server.on('error', error => {
				Logger.error(error)
				reject(error)
			})
			this.server.on('listening', () => resolve(this.server))
		})
	}
}
