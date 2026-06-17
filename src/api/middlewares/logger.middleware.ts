import { NextFunction, Request } from 'express'
import {
	ExpressMiddlewareInterface,
	Middleware,
	Req,
	Res,
} from 'routing-controllers'
import environment from '../../environment.js'
import Logger from '../../util/logger.js'

@Middleware({ type: 'before' })
export class LoggerMiddleware implements ExpressMiddlewareInterface {
	async use(@Req() req: Request, @Res() res, next: NextFunction) {
		if (environment.TESTING) return next()

		let startT = Date.now()
		res.on('finish', () => {
			let deltaT = Date.now() - startT

			let text = `[${res.statusCode}] ${req.method} {internal}${
				req.url
			} (from: ${req.header('X-Real-IP') || 'unknown'}, resolved in ${(
				deltaT / 1000
			).toLocaleString('en-us', {
				minimumFractionDigits: 3,
				maximumFractionDigits: 3,
			})}s)`

			if (res.statusCode >= 500) {
				Logger.error(text)
			} else if (res.statusCode >= 400) {
				Logger.warn(text)
			} else if (req.url === `${environment.API_BASE}healthz`) {
				Logger.debug(text)
			} else Logger.info(text)
		})
		next()
	}
}
