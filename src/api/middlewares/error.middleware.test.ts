import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from 'routing-controllers'
import { HttpErrorHandler } from './error.middleware.ts'
import Logger from '../../util/logger.ts'
import { InternalServerErrorResponse } from '../interceptors/default.interceptor.ts'

//Gemini generated, check

// 1. Mock External Dependencies
vi.mock('../../util/logger.js', () => ({
	default: {
		error: vi.fn(),
	},
}))

vi.mock('../interceptors/default.interceptor.js', () => ({
	InternalServerErrorResponse: class {
		httpCode = 500
		message = 'Internal Server Error'
		originalError: any
		constructor(error: any) {
			this.originalError = error
		}
	},
}))

describe('HttpErrorHandler', () => {
	let errorHandler: HttpErrorHandler
	let mockReq: any
	let mockRes: any
	let mockNext: any

	beforeEach(() => {
		errorHandler = new HttpErrorHandler()
		mockReq = {}

		// Create a mock response object that allows chaining (.status().json())
		mockRes = {
			headersSent: false,
			status: vi.fn().mockReturnThis(),
			json: vi.fn().mockReturnThis(),
			on: vi.fn(),
		}

		mockNext = vi.fn()
		vi.clearAllMocks()
	})

	// --- Test Case 1: Headers Already Sent ---
	it('should call next(error) and return early if headers have already been sent', () => {
		mockRes.headersSent = true
		const error = new Error('Test Error')

		errorHandler.error(error, mockReq, mockRes, mockNext)

		expect(mockNext).toHaveBeenCalledWith(error)
		expect(mockRes.status).not.toHaveBeenCalled()
		expect(mockRes.json).not.toHaveBeenCalled()
	})

	// --- Test Case 2: Known HttpError Handled ---
	it('should respond with the error httpCode and body if error is an instance of HttpError', () => {
		const httpError = new HttpError(404, 'Resource Not Found')

		errorHandler.error(httpError, mockReq, mockRes, mockNext)

		expect(mockRes.status).toHaveBeenCalledWith(404)
		expect(mockRes.json).toHaveBeenCalledWith(httpError)
		expect(mockNext).not.toHaveBeenCalled()
	})

	// --- Test Case 3: Generic Error Handled & Logged ---
	it('should wrap generic errors in InternalServerErrorResponse, return 500, and log on response finish', () => {
		const genericError = new Error('Database connection failed')
		let finishCallback: (() => void) | undefined

		// Capture the callback function passed to res.on('finish')
		mockRes.on.mockImplementation((event: string, callback: () => void) => {
			if (event === 'finish') {
				finishCallback = callback
			}
		})

		errorHandler.error(genericError, mockReq, mockRes, mockNext)

		// Assert the response setup
		expect(mockRes.status).toHaveBeenCalledWith(500)
		expect(mockRes.json).toHaveBeenCalledWith(
			expect.any(InternalServerErrorResponse),
		)
		expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function))

		// Logger should NOT be called yet because the finish event hasn't fired
		expect(Logger.error).not.toHaveBeenCalled()

		// Manually trigger the 'finish' event callback
		if (finishCallback) finishCallback()

		// Assert that logging occurs post-response finish
		expect(Logger.error).toHaveBeenCalledWith(
			expect.any(InternalServerErrorResponse),
		)
		expect(mockNext).not.toHaveBeenCalled()
	})
})
