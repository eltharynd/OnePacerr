import { FormattedArc } from '../metadata/metada.model'

export type PipelineControllerConfig = {
	SKIP_VERIFY_PRESENT_FILES: boolean
	SKIP_ORGANIZE_PRESENT_FILES: boolean
	SKIP_UPDATE_METADATA_PRESENT_FILES: boolean
	SKIP_DOWNLOADS: boolean
	SKIP_POSTERS: boolean
	INCLUDE_SPECIALS: boolean
	PREFER_EXTENDED: boolean
	PREFER_G8: boolean
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

export class NoActivePipelineError extends Error {}
export class PipelineNotReadyError extends Error {}
export class PipelineNotDoneError extends Error {}
