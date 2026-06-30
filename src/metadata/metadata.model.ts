export type Metadata = {
	lastUpdate: string

	title: string
	description: string

	genre: string[]
	mpaa: string
	customRating: string

	arcs: ArcMetadata[]
}
export type ArcMetadata = {
	arc: number

	saga: string
	title: string
	description: string

	status: 'complete' | 'tbr' | 'wip'

	mangaChapters: string
	mangaChaptersCount: number

	animeEpisodes: string
	animeEpisodesCount: number

	fillerEpisodes: string
	paceEpisodesCount: number

	animeMinutes: number
	paceMinutes: number
	savedMinutes: number
	savedPercentage: number

	audioLanguages: string[]
	subLanguages: string[]
	subLanguagesPixeldrain: string[]

	resolution: string

	episodes: EpisodeMetadata[]
}

export type EpisodeMetadata = {
	arc: number
	episode: number

	title: string
	description: string

	mangaChapters: string
	animeEpisodes: string

	released: string

	files: EpisodeFilesMetadata
}

export type EpisodeFilesMetadata = {
	standard: FileMetadata
	extended?: FileMetadata
	alternate?: FileMetadata

	archived?: FileMetadata[] //missing
}
export type FileMetadata = {
	CRC32: string
	CRC32_inFileName?: string

	hash: string //missing
	magnetURI: string //missing

	duration: number

	partOfBundle?: boolean //missing
}

export class MetadataAbsentError extends Error {
	constructor(message?: string, options?: { cause?: unknown }) {
		super(message, options)
		this.name = 'MetadataAbsentError'
	}
}
export class CRCNotInMetadata extends Error {
	constructor(message?: string, options?: { cause?: unknown }) {
		super(message, options)
		this.name = 'CRCNotInMetadata'
	}
}
