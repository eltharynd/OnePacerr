export type LibraryClient = 'none' | 'plex' | 'jellyfin' | 'emby'

export interface ILibraryController {
	readonly libraryClient: LibraryClient

	init()

	getEpisodeFile(season: number, episode: number, purePlex?: boolean)
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
	getTargetPlexFullPath(
		arc: number,
		episode: number,
		episodeDescription?: { title: string; description: string },
	)
}
