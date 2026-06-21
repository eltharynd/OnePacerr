import { MediaPart, PlexServer, Show, ShowSection } from '@ctrl/plex'
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import WebSocket from 'ws'
import environment from '../../environment.js'
import { Context } from '../../util/context.js'
import Logger from '../../util/logger.js'
import resolvePosterPath from '../../util/resolve-poster-path.js'
import sanitizeWindowsFileName from '../../util/sanitize-windows-filename.js'
import { LibraryController } from '../library.controller.js'
import {
	ILibraryController,
	LibraryClient,
	TargetLibraryFile,
} from '../library.model.js'

export class PlexController implements ILibraryController {
	libraryClient: LibraryClient = 'plex'

	private server: PlexServer
	private ws: WebSocket

	private section: ShowSection
	private show: Show

	constructor(options: { url: string; token: string }) {
		if (!options.url || !options.token) {
			throw new Error(`Plex misconfigured`)
		}
		this.server = new PlexServer(options.url, options.token)
		this.ws = new WebSocket(
			`${options.url.replace('http://', 'ws://').replace('https://', 'wss://')}/:/websockets/notifications?X-Plex-Token=${options.token}`,
		)
		this.ws.on('open', () => {
			Logger.debug('Connected to Plex Live Event Stream')
		})
		this.ws.on('error', error => {
			Logger.error('Websocket error')
			Logger.error(error)
		})

		this.ws.on('close', (code, reason) => {
			Logger.warn(
				`Plex WebSocket closed (Code: ${code}). Reconnecting in 5 seconds...`,
			)
			this.ws = null
			setTimeout(() => {
				this.ws = new WebSocket(
					`ws://${environment.PLEX_URL.replace('http://', '')}/:/websockets/notifications?X-Plex-Token=${environment.PLEX_TOKEN}`,
				)
			}, 5000)
		})
	}

	async init() {
		Logger.info(`Searching for Plex Library...`)

		this.section = await (
			await this.server.library()
		).section<ShowSection>(environment.PLEX_LIBRARY_NAME)

		Logger.info(`Found Plex Library '${this.section.title}'...`)

		await this.fetchShow()
	}

	async getLibraryFolder() {
		return await this.section.locations.map(loc => loc.path)[0]
	}

	async getExistingLibraryEpisodeFile(
		season: number,
		episode: number,
		pathAccordingToMediaServer?: boolean,
	): Promise<string> {
		let _episode
		try {
			_episode = await this.show.episode({ season: season, episode: episode })
		} catch (e) {
			Logger.info(
				`Episode ${season}-${String(episode).padStart(2, '0')} does not exists on Plex...`,
			)
			return null
		}

		if (_episode.media.length > 1) {
			Logger.error(
				`Episode ${season}-${String(episode).padStart(2, '0')} has multiple files in Plex, you should probably manually scan the library, delete the trash then relaunch...`,
			)
			//TODO handle automatic resolution perhaps
			throw new Error(
				`Multiple files on plex for Episode ${season}-${String(episode).padStart(2, '0')}`,
			)
		}
		if (_episode.media.length < 1 || _episode.media[0].parts.length < 1) {
			Logger.info(
				`Episode ${season}-${String(episode).padStart(2, '0')} exists on plex with no file...`,
			)
			return null
		}

		let part: MediaPart = _episode.media[0].parts[0]

		if (!pathAccordingToMediaServer)
			return path.resolve(
				part.file.replace(
					environment.MOUNT_LIBRARY_MEDIA_SERVER,
					environment.MOUNT_LIBRARY_ONEPACERR,
				),
			)
		else return part.file
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

		let plexLibraryPath = await Context.library.getLibraryFolder()
		let plexSeparator = plexLibraryPath.includes('/') ? '/' : '\\'

		let targetPlexFileName = LibraryController.resolveEpisodeTargetFileName(
			arc,
			episode,
			episodeDescription.title,
		)
		let targetPlexPath = `${plexLibraryPath}${plexSeparator}${environment.LIBRARY_SERIES_FOLDER_NAME}${plexSeparator}Season ${String(arc).padStart(2, '0')}${plexSeparator}`

		return {
			path: targetPlexPath,
			filename: sanitizeWindowsFileName(targetPlexFileName),
		}
	}

	async scanLibrary(folder: string, arc: number) {
		Logger.debug(`Refreshing Library`)

		let plexmatch = `show: ${environment.LIBRARY_SERIES_NAME}`
		writeFileSync(
			`${path.resolve(`${folder.replace(environment.MOUNT_LIBRARY_MEDIA_SERVER, environment.MOUNT_LIBRARY_ONEPACERR)}${path.sep}..`)}${path.sep}.plexmatch`,
			plexmatch,
		)

		try {
			await new Promise<void>(async (resolve, reject) => {
				const timeout = 10000
				let timeoutHandler
				let callback = async data => {
					let event = JSON.parse(data).NotificationContainer
					if (event.type == 'activity') {
						let notification = event.ActivityNotification[0]
						let activity = notification.Activity
						if (
							activity.title.startsWith('Scanning') &&
							activity.subtitle ==
								`${environment.LIBRARY_SERIES_FOLDER_NAME} - Season ${String(arc).padStart(2, '0')}` &&
							activity.progress >= 100
						) {
							Logger.debug(`Plex notified folder update`)
							if (!this.show) await this.fetchShow()
							if (timeoutHandler) clearTimeout(timeoutHandler)
							this.ws.off('message', callback)
							resolve()
						}
					}
				}
				this.ws.on('message', callback)

				timeoutHandler = setTimeout(() => {
					Logger.warn(
						`Plex didn't notify folder update before timeout expired...`,
					)
					reject(new PlexSocketNoResponseError())
				}, timeout)
				await this.section.update({ path: folder })
			})
		} catch (e) {
			if (e instanceof PlexSocketNoResponseError) {
				Logger.warn(
					`Assuming Plex is just being Plex and that the library got scanned by now`,
				)
			} else {
				throw e
			}
		}
	}

	async updateEpisodeMetadata(
		arc: number,
		episode: number,
		title: string,
		description: string,
	) {
		Logger.info(
			`Episode ${arc}-${String(episode).padStart(2, '0')} - Updating Metadata`,
		)

		const attempt = async (attemptsLeft: number) => {
			try {
				Logger.debug(`Metadata update attempt`)
				let _episode = await this.show.episode({
					season: arc,
					episode: episode,
				})

				await _episode.editTitle(title)
				await _episode.editSummary(description)
				return true
			} catch (e) {
				if (attemptsLeft > 1) {
					Logger.debug(
						`Metadata update attempt failed, this could just be due to how plex reports being done scanning (it sucks). Attempting ${attemptsLeft} more times...`,
					)
					return false
				} else throw new Error(`Episode could not be found on plex...`)
			}
		}

		let attemptsLeft = 5
		while (attemptsLeft-- > 0) {
			if (await attempt(attemptsLeft)) attemptsLeft = 0
		}
	}

	async updateSeasonMetadata(arc: number) {
		Logger.debug(`Updating Season ${arc} Metadata in Plex...`)
		let description = await Context.metadata.getSeasonDescription(arc)

		let season = await this.show.season(arc)

		//Bypasses a bug in @ctrl/plex
		Object.defineProperty(season, 'librarySectionID', {
			value: this.section.key,
			writable: true,
			configurable: true,
		})

		await season.editTitle(`${arc}. ${description.title}`)
		await season.editSummary(description.description)

		if (!environment.SKIP_POSTERS) {
			Logger.debug(`Updating Season ${arc} poster in Plex...`)
			await season.uploadPoster({
				file: readFileSync(resolvePosterPath({ arc })),
			})
		}
		Logger.debug(
			`Metadata${!environment.SKIP_POSTERS ? ' and posters' : ''} for Season ${arc} updated...`,
		)
	}

	async updateShowMetadata() {
		Logger.debug(`Updating Show Metadata in Plex...`)
		let description = await Context.metadata.getShowDescription()

		await this.show.editTitle(environment.LIBRARY_SERIES_NAME)
		await this.show.editSummary(description.plot)

		if (!environment.SKIP_POSTERS) {
			Logger.debug(`Updating Show poster in Plex...`)
			await this.show.uploadPoster({
				file: readFileSync(resolvePosterPath()),
			})
		}

		Logger.debug(
			`Metadata${!environment.SKIP_POSTERS ? ' and posters' : ''} for Show updated...`,
		)
	}

	private async fetchShow() {
		Logger.info(`Searching for Plex Show...`)

		let searchResults = await this.section.search({
			title: environment.LIBRARY_SERIES_NAME,
		})
		if (searchResults.length < 1) {
			if (!environment.LIBRARY_CREATE_SHOW_IF_NOT_FOUND) {
				Logger.error(
					`Could not find show '${environment.LIBRARY_SERIES_NAME}' in library '${environment.PLEX_LIBRARY_NAME}'...`,
				)
				throw new Error('Show not found')
			}
		} else if (searchResults.length > 1) {
			Logger.error(
				`Could not find show '${environment.LIBRARY_SERIES_NAME}' in library '${environment.PLEX_LIBRARY_NAME}'...`,
			)
			throw new Error('Too many shows found')
		}

		if (searchResults[0]) {
			this.show = searchResults[0]
			Logger.info(`Found Plex Show '${this.show.title}'...`)
		}
	}
}

class PlexSocketNoResponseError extends Error {}
