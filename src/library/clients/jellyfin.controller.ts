import {
	ILibraryController,
	LibraryClient,
	TargetLibraryFile,
} from '../library.model.js'

export class JellyfinController implements ILibraryController {
	readonly libraryClient: LibraryClient

	constructor(options: { url: string; username: string; password: string }) {}

	async init() {}

	async getLibraryFolder() {}

	async getExistingLibraryEpisodeFile(
		season: number,
		episode: number,
		pathAccordingToMediaServer?: boolean,
	): Promise<string> {
		return null
	}

	async getTargetLibraryEpisodeFile(
		arc: number,
		episode: number,
		episodeDescription?: { title: string; description: string },
	): Promise<TargetLibraryFile> {
		return null
	}

	async scanLibrary(folder: string, arc: number) {}

	async updateEpisodeMetadata(
		arc: number,
		episode: number,
		title: string,
		description: string,
	) {}

	async updateSeasonMetadata(arc: number) {}

	async updateShowMetadata() {}
}
