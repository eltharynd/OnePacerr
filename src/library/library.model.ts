import { EpisodeMetadata } from '../metadata/metadata.model'

export type LibraryClient = 'none' | 'plex' | 'jellyfin' | 'emby'
export type TargetLibraryFile = {
	readonly path: string
	readonly filename: string
}

export class LibraryConnectionError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options)
		this.name = 'LibraryConnectionError'
	}
}

export interface ILibraryController {
	readonly libraryClient: LibraryClient

	init()

	getLibraryFolder()

	getExistingLibraryEpisodeFile(
		episode: EpisodeMetadata,
		pathAccordingToMediaServer?: boolean,
	): Promise<string> | string

	getTargetLibraryEpisodeFile(
		episode: EpisodeMetadata,
	): Promise<TargetLibraryFile> | TargetLibraryFile

	scanLibrary(folder: string, arc: number)

	updateEpisodeMetadata(episode: EpisodeMetadata)

	updateSeasonMetadata(arc: number)

	updateShowMetadata()
}
