export type LibraryClient = 'none' | 'plex' | 'jellyfin' | 'emby'
export type TargetLibraryFile = {
	readonly path: string
	readonly filename: string
}

export interface ILibraryController {
	readonly libraryClient: LibraryClient

	init()

	getLibraryFolder()

	getExistingLibraryEpisodeFile(
		season: number,
		episode: number,
		pathAccordingToMediaServer?: boolean,
	): Promise<string> | string

	getTargetLibraryEpisodeFile(
		arc: number,
		episode: number,
		episodeDescription?: { title: string; description: string },
	): Promise<TargetLibraryFile> | TargetLibraryFile

	scanLibrary(folder: string, arc: number)

	updateEpisodeMetadata(
		arc: number,
		episode: number,
		title: string,
		description: string,
	)

	updateSeasonMetadata(arc: number)

	updateShowMetadata()
}
