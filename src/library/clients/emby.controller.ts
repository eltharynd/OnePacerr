import path from 'node:path'
import environment from '../../environment.js'
import { Context } from '../../util/context.js'
import Logger from '../../util/logger.js'
import sanitizeWindowsFileName from '../../util/sanitize-windows-filename.js'
import { LibraryController } from '../library.controller.js'
import {
	ILibraryController,
	LibraryClient,
	TargetLibraryFile,
} from '../library.model.js'
import EmbyClient, {
	EmbyConfig,
	EmbyItem,
	EmbyLibrary,
	EmbyVirtualFolder,
} from './emby.client.js'

export class EmbyController implements ILibraryController {
	readonly libraryClient: LibraryClient = 'emby'

	private emby: EmbyClient

	private library: EmbyLibrary
	private virtualFolder: EmbyVirtualFolder
	private show: EmbyItem

	constructor(config: EmbyConfig) {
		if (!config.baseUrl || !config.username || !config.password) {
			throw new Error(`Emby misconfigured`)
		}
		this.emby = new EmbyClient(config)
	}

	async init() {
		Logger.info(`Authenticating to Emby...`)
		await this.emby.login()

		Logger.info(`Searching for Emby Library...`)
		this.library = (await this.emby.getLibraries()).find(
			l => l.Name == environment.EMBY_LIBRARY_NAME,
		)

		if (!this.library) {
			Logger.error(
				`Library '${environment.EMBY_LIBRARY_NAME}' not found on Emby...`,
			)
			throw new Error()
		}

		Logger.info(`Searching for Emby Virtual Folder...`)
		this.virtualFolder = (
			await this.emby.getLibraryLocations(this.library.Name)
		)[0]

		await this.fetchShow()
	}

	async getLibraryFolder() {
		return this.virtualFolder.Locations[0]
	}

	async getExistingLibraryEpisodeFile(
		arc: number,
		episode: number,
		pathAccordingToMediaServer?: boolean,
	): Promise<string> {
		let _episode
		try {
			_episode = (await this.emby.getEpisodes(this.show.Id, ['Path'])).find(
				e => {
					return e.IndexNumber == episode && e.ParentIndexNumber == arc
				},
			)

			if (!_episode) throw new Error('Episode not on JellyEmbyfin')

			if (pathAccordingToMediaServer) return _episode.Path
			else
				return path.resolve(
					_episode.Path.replace(
						environment.MOUNT_LIBRARY_MEDIA_SERVER,
						environment.MOUNT_LIBRARY_ONEPACERR,
					),
				)
		} catch (e) {
			Logger.info(
				`Episode ${arc}-${String(episode).padStart(2, '0')} does not exists on Emby...`,
			)
			return null
		}
	}

	async getTargetLibraryEpisodeFile(
		arc: number,
		episode: number,
		episodeDescription?: { title: string; description: string },
	): Promise<TargetLibraryFile> {
		if (!episodeDescription) {
			episodeDescription = await Context.metadata.getEpisodeDescription(
				arc,
				episode,
			)
		}

		let embyLibraryPath = await Context.library.getLibraryFolder()
		let embySeparator = embyLibraryPath.includes('/') ? '/' : '\\'

		let targetEmbyFileName = LibraryController.resolveEpisodeTargetFileName(
			arc,
			episode,
			episodeDescription.title,
		)
		let targetEmbyPath = `${embyLibraryPath}${embySeparator}${environment.LIBRARY_SERIES_FOLDER_NAME}${embySeparator}Season ${String(arc).padStart(2, '0')}${embySeparator}`

		return {
			path: targetEmbyPath,
			filename: sanitizeWindowsFileName(targetEmbyFileName),
		}
	}

	async scanLibrary(folder: string, arc: number) {
		const tasks = await this.emby.getTasks()
		const scanTask = tasks.find(t => t.Key === 'RefreshLibrary')
		if (!scanTask) {
			Logger.error(`Couldn't subscribe to Emby Scan Task`)
			throw new Error()
		}

		Logger.debug(`Refreshing Library`)

		await this.emby.startTask(scanTask.Id)

		await new Promise<void>((resolve, reject) => {
			const timeoutHandler = setTimeout(() => {
				clearInterval(pollInterval)
				Logger.error(
					`Emby didn't notify folder update before timeout expired...`,
				)
				reject()
			}, 15000)

			const pollInterval = setInterval(async () => {
				const currentTask = await this.emby.getTask(scanTask.Id)

				if (currentTask.State === 'Idle') {
					Logger.debug(`Emby notified folder update`)
					clearTimeout(timeoutHandler)
					clearInterval(pollInterval)
					resolve()
				} else {
					Logger.debug(
						`Emby Scanning... ${currentTask.CurrentProgressPercentage ?? 0}%`,
					)
				}
			}, 1000)
		})
	}

	async updateEpisodeMetadata(
		arc: number,
		episode: number,
		title: string,
		description: string,
	) {
		//throw new Error('updateEpisodeMetadata')
	}

	async updateSeasonMetadata(arc: number) {
		//throw new Error('updateSeasonMetadata')
	}

	async updateShowMetadata() {
		//throw new Error('updateShowMetadata')
	}

	private async fetchShow() {
		Logger.info(`Searching for Emby Show...`)
		let searchResults = await this.emby.findShowInLibrary(
			this.library.Id,
			environment.LIBRARY_SERIES_NAME,
		)

		if (searchResults.length < 1) {
			if (!environment.LIBRARY_CREATE_SHOW_IF_NOT_FOUND) {
				Logger.error(
					`Could not find show '${environment.LIBRARY_SERIES_NAME}' in library '${environment.EMBY_LIBRARY_NAME}'...`,
				)
				throw new Error('Show not found')
			}
		} else if (searchResults.length > 1) {
			Logger.error(
				`Could not find show '${environment.LIBRARY_SERIES_NAME}' in library '${environment.EMBY_LIBRARY_NAME}'...`,
			)
			throw new Error('Too many shows found')
		}

		if (searchResults[0]) {
			this.show = searchResults[0]
			Logger.info(`Found Emby Show '${this.show.Name}'...`)
		}
	}
}
