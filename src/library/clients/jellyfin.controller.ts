import { Api, Jellyfin } from '@jellyfin/sdk'
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind.js'
import { VirtualFolderInfo } from '@jellyfin/sdk/lib/generated-client/models/virtual-folder-info.js'
import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api.js'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api.js'
import { getLibraryStructureApi } from '@jellyfin/sdk/lib/utils/api/library-structure-api.js'
import { getScheduledTasksApi } from '@jellyfin/sdk/lib/utils/api/scheduled-tasks-api.js'
import { getTvShowsApi } from '@jellyfin/sdk/lib/utils/api/tv-shows-api.js'
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api.js'
import { Logger } from 'ez-ts-logger'
import { randomUUID } from 'node:crypto'
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

export class JellyfinController implements ILibraryController {
	readonly libraryClient: LibraryClient = 'jellyfin'

	private jellyfin: Jellyfin
	private api: Api
	private credentials: { Username: string; Pw: string }

	private library
	private virtualFolder: VirtualFolderInfo
	private show

	constructor(
		private config: { baseUrl: string; username: string; password: string },
	) {
		if (!config.baseUrl || !config.username || !config.password)
			throw new Error(`Jellyfin misconfigured`)

		this.jellyfin = new Jellyfin({
			clientInfo: {
				name: 'OnePacerr',
				version: process.env.npm_package_version,
			},
			deviceInfo: {
				name: 'OnePacerr container',
				id: randomUUID(),
			},
		})

		this.api = this.jellyfin.createApi(config.baseUrl)

		this.credentials = {
			Username: config.username,
			Pw: config.password,
		}
	}

	async init() {
		Logger.info(`Authenticating to Jellyfin at ${this.config.baseUrl}...`)
		await getUserApi(this.api).authenticateUserByName({
			authenticateUserByName: this.credentials,
		})

		Logger.info(
			`Searching for Jellyfin Library '${environment.JELLYFIN_LIBRARY_NAME}'...`,
		)
		this.library = (
			await getLibraryApi(this.api).getMediaFolders()
		).data.Items.find(mf => mf.Name == environment.JELLYFIN_LIBRARY_NAME)

		if (!this.library) {
			const available = (
				await getLibraryApi(this.api).getMediaFolders()
			).data.Items.map(l => l.Name).join(', ')

			throw new LibraryConnectionError(
				`Jellyfin library '${environment.JELLYFIN_LIBRARY_NAME}' not found at ${this.config.baseUrl}. Available libraries: ${available || 'none'}`,
			)
		}

		Logger.info(`Searching for Jellyfin Virtual Folder...`)
		this.virtualFolder = (
			await getLibraryStructureApi(this.api).getVirtualFolders()
		).data.find(vf => vf.Name == environment.JELLYFIN_LIBRARY_NAME)

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
			_episode = (
				await getTvShowsApi(this.api).getEpisodes({
					seriesId: this.show.Id,
					fields: ['Path' as any],
				})
			).data.Items.find(e => {
				return e.IndexNumber == episode && e.ParentIndexNumber == arc
			})

			if (!_episode) throw new Error('Episode not on Jellyfin')

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
		const tasksApi = getScheduledTasksApi(this.api)
		const tasks = (await tasksApi.getTasks()).data
		const scanTask = tasks.find(t => t.Key === 'RefreshLibrary')
		if (!scanTask) {
			Logger.error(`Couldn't subscribe to Jellyfin Scan Task`)
			throw new Error()
		}

		Logger.debug(`Refreshing Library`)
		await tasksApi.startTask({ taskId: scanTask.Id })

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
				const currentTask = await tasksApi.getTask({ taskId: scanTask.Id })

				if (currentTask.data.State === 'Idle') {
					Logger.debug(`Jellyfin notified folder update`)
					clearTimeout(timeoutHandler)
					clearInterval(pollInterval)
					resolve()
				} else {
					if (timeoutHandler) clearInterval(timeoutHandler)
					timeoutHandler = setTimeout(timeoutCallback, 15000)
					Logger.debug(
						`Jellyfin Scanning... ${currentTask.data.CurrentProgressPercentage ?? 0}%`,
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
		Logger.info(`Searching for Jellyfin Show...`)

		let searchResults = (
			await getItemsApi(this.api).getItems({
				searchTerm: environment.LIBRARY_SERIES_NAME,
				includeItemTypes: [BaseItemKind.Series],
				recursive: true,
				parentId: this.library.ItemId,
			})
		).data.Items.filter(s => s.Name == environment.LIBRARY_SERIES_NAME)

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
