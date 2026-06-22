export type TorrentInfo = {
	magnetURI: string
	infoHash: string
}

export type Episode = {
	arc: number
	episode: number
}
export type EpisodeDescription = {
	title: string
	description: string
}

export type Metadata = {
	status: {
		last_update: string
		last_update_ts: number
	}
	tvshow: any
	arcs: {
		[key: string]: {
			part: number
			saga: string
			title: string
			description: string
			episodes: {
				episode: string
				standard: string
				extended: string
			}[]
		}[]
	}
	descriptions: {
		[key: string]: {
			arc: number
			episode: number
			title: string
			description: string
		}[]
	}
	episodes: {
		[key: string]: {
			arc: number
			episode: number
			extended: boolean
		}
	}
	other_edits: any
}

type PipelineStatus = 'PRE' | 'RUNNING' | 'DONE' | 'ERRORED'

export class PipelineReport {
	created: Date
	started: Date
	ended: Date
	processedEpisodes: number
	monitoredEpisodes: number
	status: PipelineStatus
	error?: string

	constructor() {
		this.created = new Date()
		this.status = 'PRE'
	}
}

export class MetadataAbsentError extends Error {}
