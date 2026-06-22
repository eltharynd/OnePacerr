import { Controller, Get } from 'routing-controllers'
import { Context } from '../../util/context.js'

@Controller(`/status`)
export class StatusController {
	@Get(`/metadata`)
	async metadata() {
		return await Context.metadata.getStatusReport()
	}
	@Get(`/pipeline`)
	async pipeline() {
		return await Context.metadata.getPipelineReport()
	}
}
