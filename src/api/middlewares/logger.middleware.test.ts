import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoggerMiddleware } from './logger.middleware.ts'
import Logger from '../../util/logger.ts'
import environment from '../../environment.ts'

//Gemini generated, check

// 1. Mock External Dependencies
vi.mock('../../util/logger.js', () => ({
	default: {
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
	},
}))

vi.mock('../../environment.js', () => ({
	default: {
		TESTING: false,
		API_BASE: '/api/v1/',
	},
}))

describe('LoggerMiddleware', () => {
	let middleware: LoggerMiddleware
	let mockReq: any
	let mockRes: any
	let mockNext: any

	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z')) // Establish baseline time

		middleware = new LoggerMiddleware()

		mockReq = {
			method: 'GET',
			url: '/api/v1/resource',
			header: vi.fn().mockReturnValue('127.0.0.1'),
		}

		mockRes = {
			statusCode: 200,
			on: vi.fn(),
		}

		mockNext = vi.fn()

		// Reset mutable environment config defaults before each test
		environment.TESTING = false
		environment.API_BASE = '/api/v1/'
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	// --- Test Case 1: Testing Environment Bypass ---
	it('should immediately call next() and bypass logging if environment.TESTING is true', async () => {
		environment.TESTING = true

		await middleware.use(mockReq, mockRes, mockNext)

		expect(mockNext).toHaveBeenCalled()
		expect(mockRes.on).not.toHaveBeenCalled()
	})

	// --- Test Case 2: Logger.error (Status >= 500) ---
	it('should log an error message if statusCode is >= 500', async () => {
		let finishCallback: (() => void) | undefined
		mockRes.on.mockImplementation((event: string, callback: () => void) => {
			if (event === 'finish') finishCallback = callback
		})

		mockRes.statusCode = 503
		mockReq.method = 'POST'
		mockReq.url = '/api/v1/submit'

		await middleware.use(mockReq, mockRes, mockNext)

		// Advance fake timer by 1.5 seconds (1500ms)
		vi.advanceTimersByTime(1500)

		// Trigger the response finish event
		if (finishCallback) finishCallback()

		expect(Logger.error).toHaveBeenCalledWith(
			'[503] POST {internal}/api/v1/submit (from: 127.0.0.1, resolved in 1.500s)',
		)
		expect(mockNext).toHaveBeenCalled()
	})

	// --- Test Case 3: Logger.warn (Status >= 400) ---
	it('should log a warning message if statusCode is between 400 and 499', async () => {
		let finishCallback: (() => void) | undefined
		mockRes.on.mockImplementation((event: string, callback: () => void) => {
			if (event === 'finish') finishCallback = callback
		})

		mockRes.statusCode = 404

		await middleware.use(mockReq, mockRes, mockNext)
		vi.advanceTimersByTime(250)
		if (finishCallback) finishCallback()

		expect(Logger.warn).toHaveBeenCalledWith(
			'[404] GET {internal}/api/v1/resource (from: 127.0.0.1, resolved in 0.250s)',
		)
	})

	// --- Test Case 4: Logger.debug (Health Check URL) ---
	it('should log a debug message if the URL is the healthz endpoint', async () => {
		let finishCallback: (() => void) | undefined
		mockRes.on.mockImplementation((event: string, callback: () => void) => {
			if (event === 'finish') finishCallback = callback
		})

		mockRes.statusCode = 200
		mockReq.url = '/api/v1/healthz'

		await middleware.use(mockReq, mockRes, mockNext)
		vi.advanceTimersByTime(5)
		if (finishCallback) finishCallback()

		expect(Logger.debug).toHaveBeenCalledWith(
			'[200] GET {internal}/api/v1/healthz (from: 127.0.0.1, resolved in 0.005s)',
		)
	})

	// --- Test Case 5: Logger.info (Standard Successful Routes) ---
	it('should log an info message for standard successful responses', async () => {
		let finishCallback: (() => void) | undefined
		mockRes.on.mockImplementation((event: string, callback: () => void) => {
			if (event === 'finish') finishCallback = callback
		})

		mockRes.statusCode = 200

		await middleware.use(mockReq, mockRes, mockNext)
		vi.advanceTimersByTime(1234)
		if (finishCallback) finishCallback()

		expect(Logger.info).toHaveBeenCalledWith(
			'[200] GET {internal}/api/v1/resource (from: 127.0.0.1, resolved in 1.234s)',
		)
	})

	// --- Test Case 6: IP Fallback handling ---
	it('should output "unknown" if the X-Real-IP header is absent', async () => {
		let finishCallback: (() => void) | undefined
		mockRes.on.mockImplementation((event: string, callback: () => void) => {
			if (event === 'finish') finishCallback = callback
		})

		// Simulate missing header mapping
		mockReq.header.mockReturnValue(undefined)
		mockRes.statusCode = 200

		await middleware.use(mockReq, mockRes, mockNext)
		vi.advanceTimersByTime(0)
		if (finishCallback) finishCallback()

		expect(Logger.info).toHaveBeenCalledWith(
			'[200] GET {internal}/api/v1/resource (from: unknown, resolved in 0.000s)',
		)
	})
})
