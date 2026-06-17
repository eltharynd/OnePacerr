import { Controller, Get } from 'routing-controllers'
import { OkResponse } from '../interceptors/default.interceptor.js'

@Controller(`/healthz`)
export class HealthController {
	@Get(`/`)
	healthz() {
		return new OkResponse()
	}
}
