import { NextFunction, Request, Response } from 'express'
import {
	ExpressErrorMiddlewareInterface,
	HttpError,
	Middleware,
	Req,
	Res,
} from 'routing-controllers'
import Logger from '../../util/logger.js'
import { InternalServerErrorResponse } from '../interceptors/default.interceptor.js'

@Middleware({ type: 'after' })
export class HttpErrorHandler implements ExpressErrorMiddlewareInterface {
	error(
		error: any,
		@Req() req: Request,
		@Res() res: Response,
		next: NextFunction,
	) {
		if (res.headersSent) return next(error)

		if (error instanceof HttpError) {
			res.status(error.httpCode).json(error)
		} else {
			let _error = new InternalServerErrorResponse(error)
			res.on('finish', () => {
				Logger.error(_error)
			})
			res.status(_error.httpCode).json(_error)
		}
	}
}
