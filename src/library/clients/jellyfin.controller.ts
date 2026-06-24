import { Logger } from 'ez-ts-logger'
import path from 'node:path'
import environment from '../../environment.js'
import { Context } from '../../util/context.js'
import sanitizeWindowsFileName from '../../util/sanitize-windows-filename.js'
import { LibraryController } from '../library.controller.js'
import {
	ILibraryController,
	LibraryClient,
	LibraryConnectionError,
	TargetLibraryFile,
} from '../library.model.js'
import JellyfinClient, {
	JellyfinConfig,
	JellyfinItem,
	JellyfinLibrary,
	JellyfinVirtualFolder,
} from './jellyfin.client.js'

export class JellyfinController implements ILibraryController {
	readonly libraryClient: LibraryClient = 'jellyfin'

	private jellyfin: JellyfinClient

	private library: JellyfinLibrary
	private virtualFolder: JellyfinVirtualFolder
	private show: JellyfinItem

	constructor(private config: JellyfinConfig) {
		if (!config.baseUrl || !config.username || !config.password) {
			throw new LibraryConnectionError(
				'Could not connect to Jellyfin — check JELLYFIN_URL and credentials. Set JELLYFIN_URL, JELLYFIN_USERNAME, and JELLYFIN_PASSWORD',
			)
		}
		this.jellyfin = new JellyfinClient(config)
	}

	async init() {
		Logger.info(`Authenticating to Jellyfin at ${this.config.baseUrl}...`)
		await this.jellyfin.login()

		Logger.info(
			`Searching for Jellyfin Library '${environment.JELLYFIN_LIBRARY_NAME}'...`,
		)
		this.library = (await this.jellyfin.getLibraries()).find(
			l => l.Name == environment.JELLYFIN_LIBRARY_NAME,
		)

		if (!this.library) {
			const available = (await this.jellyfin.getLibraries())
				.map(l => l.Name)
				.join(', ')
			throw new LibraryConnectionError(
				`Jellyfin library '${environment.JELLYFIN_LIBRARY_NAME}' not found at ${this.config.baseUrl}. Available libraries: ${available || 'none'}`,
			)
		}

		Logger.info(`Searching for Jellyfin Virtual Folder...`)
		const virtualFolders = await this.jellyfin.getLibraryLocations(
			this.library.Name,
		)
		this.virtualFolder = virtualFolders[0]

		if (!this.virtualFolder?.Locations?.[0]) {
			throw new LibraryConnectionError(
				`Jellyfin library '${this.library.Name}' has no folder locations configured at ${this.config.baseUrl}`,
			)
		}

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
			_episode = (await this.jellyfin.getEpisodes(this.show.Id, ['Path'])).find(
				e => {
					return e.IndexNumber == episode && e.ParentIndexNumber == arc
				},
			)

			if (!_episode) throw new Error('Episode not on JellyJellyfinfin')

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
				`Episode ${arc}-${String(episode).padStart(2, '0')} does not exists on Jellyfin...`,
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

		let jellyfinLibraryPath = await Context.library.getLibraryFolder()
		let jellyfinSeparator = jellyfinLibraryPath.includes('/') ? '/' : '\\'

		let targetJellyfinFileName = LibraryController.resolveEpisodeTargetFileName(
			arc,
			episode,
			episodeDescription.title,
		)
		let targetJellyfinPath = `${jellyfinLibraryPath}${jellyfinSeparator}${environment.LIBRARY_SERIES_FOLDER_NAME}${jellyfinSeparator}Season ${String(arc).padStart(2, '0')}${jellyfinSeparator}`

		return {
			path: targetJellyfinPath,
			filename: sanitizeWindowsFileName(targetJellyfinFileName),
		}
	}

	async scanLibrary(folder: string, arc: number) {
		const tasks = await this.jellyfin.getTasks()
		const scanTask = tasks.find(t => t.Key === 'RefreshLibrary')
		if (!scanTask) {
			Logger.error(`Couldn't subscribe to Jellyfin Scan Task`)
			throw new Error()
		}

		Logger.debug(`Refreshing Library`)

		if (this.show.Id) {
			Logger.debug(`Jellyfin Show already exits, refreshing show only`)
			await this.jellyfin.refreshSeries(this.show.Id)
		} else {
			Logger.debug(
				`Jellyfin doesn't have the show already, scanning the whole Library`,
			)
			await this.jellyfin.startTask(scanTask.Id)
		}

		await new Promise<void>((resolve, reject) => {
			const timeoutCallback = () => {
				clearInterval(pollInterval)
				Logger.error(
					`Jellyfin didn't notify folder update before timeout expired...`,
				)
				reject()
			}
			let timeoutHandler = setTimeout(timeoutCallback, 15000)

			const pollInterval = setInterval(async () => {
				const currentTask = await this.jellyfin.getTask(scanTask.Id)

				if (currentTask.State === 'Idle') {
					Logger.debug(`Jellyfin notified folder update`)
					clearTimeout(timeoutHandler)
					clearInterval(pollInterval)
					resolve()
				} else {
					if (timeoutHandler) clearInterval(timeoutHandler)
					timeoutHandler = setTimeout(timeoutCallback, 15000)
					Logger.debug(
						`Jellyfin Scanning... ${currentTask.CurrentProgressPercentage ?? 0}%`,
					)
				}
			}, 1000)
		})

		if (!this.show) {
			await this.fetchShow()
		}
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
		Logger.info(`Searching for Jellyfin Show...`)
		let searchResults = await this.jellyfin.findShowInLibrary(
			this.library.Id,
			environment.LIBRARY_SERIES_NAME,
		)

		if (searchResults.length < 1) {
			if (!environment.LIBRARY_CREATE_SHOW_IF_NOT_FOUND) {
				Logger.error(
					`Could not find show '${environment.LIBRARY_SERIES_NAME}' in library '${environment.JELLYFIN_LIBRARY_NAME}'...`,
				)
				throw new Error('Show not found')
			}
		} else if (searchResults.length > 1) {
			Logger.error(
				`Could not find show '${environment.LIBRARY_SERIES_NAME}' in library '${environment.JELLYFIN_LIBRARY_NAME}'...`,
			)
			throw new Error('Too many shows found')
		}

		if (searchResults[0]) {
			this.show = searchResults[0]
			Logger.info(`Found Jellyfin Show '${this.show.Name}'...`)
		}
	}
}
