import capitalizeWords from 'capitalize'
import {
	Action,
	HttpError,
	Interceptor,
	InterceptorInterface,
} from 'routing-controllers'

@Interceptor()
export class DefaultInterceptor implements InterceptorInterface {
	intercept(action: Action, content: any) {
		if (content instanceof DefaultResponse) {
			action.response.status(content.httpCode)
		} else if (!content) {
			content = new OkResponse()
		}
		return content
	}
}

class DefaultResponse {
	readonly name: string
	readonly httpCode: number
	message: string
	extra: any

	constructor(name: string, httpCode: number, message?: any, extra?: any) {
		this.name = name
		this.httpCode = httpCode
		this.message =
			message?.message || message || DefaultResponse.getDefaultMessage(name)
		this.extra = extra
	}

	static getDefaultMessage(name: string): string {
		return capitalizeWords(name.replaceAll('_', ' '))
	}
}

export class ErrorResponse extends HttpError {
	public readonly extra: any

	constructor(
		public readonly name: string,
		httpCode: number,
		message?: string,
		extra?: any,
	) {
		super(httpCode, message || ErrorResponse.getDefaultMessage(name))
		Object.setPrototypeOf(this, new.target.prototype)

		this.name = name
		this.extra = extra

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor)
		} else this.stack = new Error(message).stack
	}

	static getDefaultMessage(name: string): string {
		return capitalizeWords(name.replaceAll('_', ' '))
	}
}

export class OkResponse extends DefaultResponse {
	constructor(message?: string, extra?: any) {
		super('OK', 200, message, extra)
	}
}

export class CreatedResponse extends DefaultResponse {
	constructor(message?: string, extra?: any) {
		super('CREATED', 201, message, extra)
	}
}

export class AcceptedResponse extends DefaultResponse {
	constructor(message?: string, extra?: any) {
		super('ACCEPTED', 202, message, extra)
	}
}

export class NoContentResponse extends DefaultResponse {
	constructor(message?: string, extra?: any) {
		super('NO_CONTENT', 204, message, extra)
	}
}

export class PartialContentResponse extends DefaultResponse {
	constructor(message?: string, extra?: any) {
		super('PARTIAL_CONTENT', 206, message, extra)
	}
}

export class BadRequestErrorResponse extends ErrorResponse {
	missing: any

	constructor(error?: string, extra?: any) {
		super('BAD_REQUEST', 400, error, extra)
		Object.setPrototypeOf(this, new.target.prototype)
	}
}

export class UnauthorizedErrorResponse extends ErrorResponse {
	constructor(error?: string, extra?: any) {
		super('UNAUTHORIZED', 401, error, extra)
		Object.setPrototypeOf(this, new.target.prototype)
	}
}

export class ForbiddenErrorResponse extends ErrorResponse {
	constructor(error?: string, extra?: any) {
		super('FORBIDDEN', 403, error, extra)
		Object.setPrototypeOf(this, new.target.prototype)
	}
}

export class NotFoundErrorResponse extends ErrorResponse {
	constructor(error?: string, extra?: any) {
		super('NOT_FOUND', 404, error, extra)
		Object.setPrototypeOf(this, new.target.prototype)
	}
}

export class MethodNotAllowedErrorResponse extends ErrorResponse {
	constructor(message?: string, extra?: any) {
		super('METHOD_NOT_ALLOWED', 405, message, extra)
		Object.setPrototypeOf(this, new.target.prototype)
	}
}

export class ConflictErrorResponse extends ErrorResponse {
	constructor(message?: string, extra?: any) {
		super('CONFLICT', 409, message, extra)
		Object.setPrototypeOf(this, new.target.prototype)
	}
}

export class GoneErrorResponse extends ErrorResponse {
	constructor(message?: string, extra?: any) {
		super('GONE', 410, message, extra)
		Object.setPrototypeOf(this, new.target.prototype)
	}
}

export class UnprocessableContentErrorResponse extends ErrorResponse {
	constructor(message?: string, extra?: any) {
		super('UNPROCESSABLE_CONTENT', 422, message, extra)
		Object.setPrototypeOf(this, new.target.prototype)
	}
}

export class InternalServerErrorResponse extends ErrorResponse {
	constructor(message?: string, extra?: any) {
		super('INTERNAL_SERVER_ERROR', 500, message, extra)
		Object.setPrototypeOf(this, new.target.prototype)
	}
}
