import { Controller, Get } from 'routing-controllers'
import { Context } from '../../util/context.js'

@Controller(`/status`)
export class StatusController {
	@Get(`/metadata`)
	async metadata() {
		return await Context.metadata.getReport()
	}
	@Get(`/pipeline`)
	async pipeline() {
		return await Context.pipeline.getReport()
	}
}
