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

export type RawMetadataJson = {
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

export type FormattedArc = {
	arc: number
	title: string
	description: string
	episodes: FormattedEpisode[]
}

export type FormattedEpisode = {
	episode: number
	title: string
	description: string
	CRC32: {
		standard: string
		extended: string
	}
}

export class MetadataAbsentError extends Error {}
