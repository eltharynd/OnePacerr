import { FormattedArc } from '../metadata/metadata.model'

export type PipelineControllerConfig = {
	PIPELINE_SKIP_VERIFY_PRESENT_FILES: boolean
	PIPELINE_SKIP_VERIFY_NOT_FOR_EXTENDED: boolean
	PIPELINE_SKIP_ORGANIZE_PRESENT_FILES: boolean
	PIPELINE_SKIP_UPDATE_METADATA_PRESENT_FILES: boolean
	PIPELINE_SKIP_DOWNLOADS: boolean
	PIPELINE_SKIP_DOWNLOADS_IMPORTS: boolean
	PIPELINE_FORCE_REDOWNLOAD: boolean
	PIPELINE_SKIP_POSTERS: boolean
	PIPELINE_INCLUDE_SPECIALS: boolean
	PIPELINE_PREFER_EXTENDED: boolean
	PIPELINE_PREFER_G8: boolean
	PIPELINE_RETRY_INTERVAL: number
}

type PipelineStatus = 'PRE' | 'READY' | 'RUNNING' | 'DONE' | 'ERRORED'

export class PipelineReport {
	created: Date = new Date()
	started: Date
	ended: Date
	monitored: FormattedArc[] = []
	processedEpisodes: number = 0
	monitoredEpisodes: number = 0
	status: PipelineStatus = 'PRE'
	error?: string
}

export class NoActivePipelineError extends Error {
	constructor(message?: string, options?: { cause?: unknown }) {
		super(message, options)
		this.name = 'NoActivePipelineError'
	}
}
export class PipelineNotReadyError extends Error {
	constructor(message?: string, options?: { cause?: unknown }) {
		super(message, options)
		this.name = 'PipelineNotReadyError'
	}
}
export class PipelineNotDoneError extends Error {
	constructor(message?: string, options?: { cause?: unknown }) {
		super(message, options)
		this.name = 'PipelineNotDoneError'
	}
}
