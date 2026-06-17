import { describe, expect, it } from 'vitest'
import { HealthController } from './health.controller.js'
import { OkResponse } from '../interceptors/default.interceptor.js'

describe('Healthcheck', () => {
	let _HealthController = new HealthController()

	it('Should answer a healthcheck', () => {
		expect(_HealthController.healthz()).toBeInstanceOf(OkResponse)
	})
})
