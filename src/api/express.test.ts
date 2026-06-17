import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createExpressServer } from 'routing-controllers'
import { createServer } from 'node:http'
import environment from '../environment.ts'
import Logger from '../util/logger.ts'
import { Express } from './express.ts'

// Import dependencies to references their types for mocks
import { AuthController } from './auth/auth.controller.ts'
import { HealthController } from './health/health.controller.ts'
import { JWTController } from './jwt/jwt.controller.ts'
import { TestController } from './test/test.controller.ts'
import { HttpErrorHandler } from './middlewares/error.middleware.ts'
import { LoggerMiddleware } from './middlewares/logger.middleware.ts'
import { DefaultInterceptor } from './interceptors/default.interceptor.ts'

//Gemini generated, check

// 1. Mock External Node Modules & Framework Wrapper
const mockApp = {
	set: vi.fn(),
}

const mockServer = {
	listen: vi.fn(),
	on: vi.fn(),
}

vi.mock('routing-controllers', async importOriginal => {
	const actual = await importOriginal<typeof import('routing-controllers')>()
	return {
		...actual, // Keeps @Middleware, @Interceptor, Req, Res, etc. intact
		createExpressServer: vi.fn(() => mockApp), // Overwrites just this function
	}
})

vi.mock('node:http', () => ({
	createServer: vi.fn(() => mockServer),
	Server: vi.fn(),
}))

vi.mock('../util/logger.ts', () => ({
	default: {
		error: vi.fn(),
	},
}))

vi.mock('../environment.ts', () => ({
	default: {
		API_BASE: '/api/v1/', // includes trailing slash to test regex sanitization
		PORT: 3000,
	},
}))

describe('Express Server Initialization Class', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	// --- Test Case 1: Constructor Framework Bootstrapping ---
	it('should initialize routing-controllers and http server with correct configuration', () => {
		const expressInstance = new Express()

		// Verify routing-controllers configuration payload
		expect(createExpressServer).toHaveBeenCalledWith({
			cors: {
				origin: ['*'],
				optionsSuccessStatus: 200,
				credentials: true,
			},
			routePrefix: '/api/v1', // Confirms trailing slash is removed
			defaultErrorHandler: false,
			middlewares: [LoggerMiddleware, HttpErrorHandler],
			controllers: [
				AuthController,
				HealthController,
				JWTController,
				TestController,
			],
			interceptors: [DefaultInterceptor],
			validation: { whitelist: true },
			classToPlainTransformOptions: {
				enableCircularCheck: true,
			},
		})

		// Verify proxy and node wrapper parameters
		expect(mockApp.set).toHaveBeenCalledWith('trust proxy', true)
		expect(createServer).toHaveBeenCalledWith(mockApp)
		expect(expressInstance.app).toBe(mockApp)
		expect(expressInstance.server).toBe(mockServer)
	})

	// --- Test Case 2: Start Method using Default Environment Port ---
	it('should listen on environment.PORT when no port override is provided', async () => {
		// Intercept .on to simulate successful startup event sequence
		mockServer.on.mockImplementation((event: string, callback: any) => {
			if (event === 'listening') {
				callback()
			}
		})

		const expressInstance = new Express()
		const startPromise = expressInstance.start()

		expect(mockServer.listen).toHaveBeenCalledWith(environment.PORT)
		await expect(startPromise).resolves.toBe(mockServer)
	})

	// --- Test Case 3: Start Method using Port Override Variable ---
	it('should listen on port override argument when provided', async () => {
		mockServer.on.mockImplementation((event: string, callback: any) => {
			if (event === 'listening') callback()
		})

		const expressInstance = new Express()
		const startPromise = expressInstance.start(8080)

		expect(mockServer.listen).toHaveBeenCalledWith(8080)
		await expect(startPromise).resolves.toBe(mockServer)
	})

	// --- Test Case 4: Network Error Exception Handlings ---
	it('should log an error and reject the promise if the server encounters an error event', async () => {
		const networkError = new Error('EADDRINUSE: Address already in use')

		// Intercept .on to trigger error branch instantly
		mockServer.on.mockImplementation((event: string, callback: any) => {
			if (event === 'error') {
				callback(networkError)
			}
		})

		const expressInstance = new Express()
		const startPromise = expressInstance.start()

		await expect(startPromise).rejects.toThrow(
			'EADDRINUSE: Address already in use',
		)
		expect(Logger.error).toHaveBeenCalledWith(networkError)
	})
})
