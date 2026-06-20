import environment from '../environment.js'
import Logger from '../util/logger.js'
import { JellyfinController } from './clients/jellyfin.controller.js'
import { LocalFolderController } from './clients/local-folder.controller.js'
import { PlexController } from './clients/plex.controller.js'
import {
	ILibraryController,
	LibraryClient,
	TargetLibraryFile,
} from './library.model.js'

export class LibraryController {
	private client: ILibraryController

	constructor() {
		switch (environment.LIBRARY_MEDIA_SERVER as LibraryClient) {
			case 'none':
				this.client = new LocalFolderController({
					root: environment.LIBRARY_NONE_ROOT_FOLDER,
				})
				break
			case 'plex':
				this.client = new PlexController({
					url: environment.PLEX_URL,
					token: environment.PLEX_TOKEN,
				})
				break
			case 'jellyfin':
				this.client = new JellyfinController({
					url: environment.JELLYFIN_URL,
					username: environment.JELLYFIN_USERNAME,
					password: environment.JELLYFIN_PASSWORD,
				})
				break
			case 'emby':
			default:
				Logger.error(
					`Media Server '${environment.LIBRARY_MEDIA_SERVER}' not implemented yet...`,
				)
				throw new Error()
		}
	}

	async init() {
		this.client.init()
	}

	async getLibraryFolder() {
		return this.client.getLibraryFolder()
	}

	async getExistingLibraryEpisodeFile(
		season: number,
		episode: number,
		pathAccordingToMediaServer?: boolean,
	): Promise<string> {
		return await this.client.getExistingLibraryEpisodeFile(
			season,
			episode,
			pathAccordingToMediaServer,
		)
	}

	async getTargetLibraryEpisodeFile(
		arc: number,
		episode: number,
		episodeDescription?: { title: string; description: string },
	): Promise<TargetLibraryFile> {
		return this.client.getTargetLibraryEpisodeFile(
			arc,
			episode,
			episodeDescription,
		)
	}

	async scanLibrary(folder: string, arc: number) {
		return this.client.scanLibrary(folder, arc)
	}
	async updateEpisodeMetadata(
		arc: number,
		episode: number,
		title: string,
		description: string,
	) {
		return this.client.updateEpisodeMetadata(arc, episode, title, description)
	}

	async updateSeasonMetadata(arc: number) {
		return this.client.updateSeasonMetadata(arc)
	}

	async updateShowMetadata() {
		return this.client.updateShowMetadata()
	}

	static resolveEpisodeTargetFileName(
		arc: number,
		episode: number,
		title: string,
	) {
		const format = environment.LIBRARY_FILENAME_FORMAT
		const variables: Record<string, string> = {
			SERIES_NAME: environment.LIBRARY_SERIES_NAME,
			ARC: String(arc).padStart(2, '0'),
			EPISODE: String(episode).padStart(2, '0'),
			TITLE: title,
		}

		let targetFileName = format.replace(/\{(\w+)\}/g, (match, key) => {
			if (!(key in variables)) {
				throw new Error(
					`Unknown placeholder in LIBRARY_FILENAME_FORMAT: {${key}}`,
				)
			}
			return variables[key]
		})
		targetFileName = targetFileName.replace(/(\.mkv)*$/, '.mkv')
		return targetFileName
	}
}
