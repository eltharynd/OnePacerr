export type LibraryClient = 'none' | 'plex' | 'jellyfin' | 'emby'
export type TargetLibraryFile = {
	readonly path: string
	readonly filename: string
}

export interface ILibraryController {
	readonly libraryClient: LibraryClient

	init()

	getEpisodeFilePath(
		season: number,
		episode: number,
		pathAccordingToMediaServer?: boolean,
	)
	getLibraryFolder()
	scanLibrary(folder: string, arc: number)
	updateEpisodeMetadata(
		arc: number,
		episode: number,
		title: string,
		description: string,
	)
	updateSeasonMetadata(arc: number)
	updateShowMetadata()
	getTargetLibraryPath(
		arc: number,
		episode: number,
		episodeDescription?: { title: string; description: string },
	)
}
