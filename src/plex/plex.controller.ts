import { MediaPart, PlexServer, Show, ShowSection } from '@ctrl/plex'
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import WebSocket from 'ws'
import environment from '../environment.js'
import { Context } from '../util/context.js'
import Logger from '../util/logger.js'
import sanitizeWindowsFileName from '../util/sanitizeWindowsFilename.js'
import resolvePosterPath from '../util/resolvePosterPath.js'

export class PlexController {
	private ws

	private server: PlexServer
	private section: ShowSection
	private show: Show

	constructor() {
		this.server = new PlexServer(environment.PLEX_URL, environment.PLEX_TOKEN)
		this.ws = new WebSocket(
			`ws://${environment.PLEX_URL.replace('http://', '')}/:/websockets/notifications?X-Plex-Token=${environment.PLEX_TOKEN}`,
		)
		this.ws.on('open', () => {
			Logger.debug('Connected to Plex Live Event Stream')
		})
		this.ws.on('error', error => {
			Logger.error('Websocket error')
			Logger.error(error)
		})

		this.ws.on('close', (code, reason) => {
			Logger.debug(
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

	private async fetchShow() {
		Logger.info(`Searching for Plex Show...`)

		let searchResults = await this.section.search({
			title: environment.PLEX_SERIES_NAME,
		})
		if (searchResults.length < 1) {
			if (!environment.PLEX_CREATE_SHOW_IF_NOT_FOUND) {
				Logger.error(
					`Could not find show '${environment.PLEX_SERIES_NAME}' in library '${environment.PLEX_LIBRARY_NAME}'...`,
				)
				throw new Error('Show not found')
			}
		} else if (searchResults.length > 1) {
			Logger.error(
				`Could not find show '${environment.PLEX_SERIES_NAME}' in library '${environment.PLEX_LIBRARY_NAME}'...`,
			)
			throw new Error('Too many shows found')
		}

		if (searchResults[0]) {
			this.show = searchResults[0]
			Logger.info(`Found Plex Show '${this.show.title}'...`)
		}
	}

	async getEpisodeFile(season: number, episode: number, purePlex?: boolean) {
		let _episode
		try {
			_episode = await this.show.episode({ season: season, episode: episode })
		} catch (e) {
			Logger.info(
				`Episode ${season}-${String(episode).padStart(2, '0')} does not exists on plex...`,
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

		if (!purePlex)
			return path.resolve(
				part.file.replace(
					environment.MOUNT_LIBRARY_PLEX,
					environment.MOUNT_LIBRARY_ONEPACERR,
				),
			)
		else return part.file
	}

	async getLibraryFolder() {
		return await this.section.locations.map(loc => loc.path)[0]
	}

	async scanLibrary(folder: string, arc: number) {
		Logger.debug(`Refreshing Library`)

		let plexmatch = `show: ${environment.PLEX_SERIES_NAME}`
		writeFileSync(
			`${path.resolve(sanitizeWindowsFileName(`${folder.replace(environment.MOUNT_LIBRARY_PLEX, environment.MOUNT_LIBRARY_ONEPACERR)}${path.sep}..`))}${path.sep}.plexmatch`,
			plexmatch,
		)

		return new Promise<void>(async (resolve, reject) => {
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
							`${environment.PLEX_SERIES_FOLDER_NAME} - Season ${String(arc).padStart(2, '0')}` &&
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
				Logger.error(
					`Plex didn't notify folder update before timeout expired...`,
				)
				reject()
			}, timeout)
			await this.section.update({ path: folder })
		})
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

		await this.show.editTitle(environment.PLEX_SERIES_NAME)
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

	async getTargetPlexFullPath(
		arc: number,
		episode: number,
		episodeDescription?: { title: string; description: string },
	): Promise<{ targetPlexFileName: string; targetPlexPath: string }> {
		if (!episodeDescription) {
			episodeDescription = await Context.metadata.getEpisodeDescription(
				arc,
				episode,
			)
		}

		let plexLibraryPath = await Context.plex.getLibraryFolder()
		let plexSeparator = plexLibraryPath.includes('/') ? '/' : '\\'

		const format = environment.PLEX_FILENAME_FORMAT
		const variables: Record<string, string> = {
			SERIES_NAME: environment.PLEX_SERIES_NAME,
			ARC: String(arc).padStart(2, '0'),
			EPISODE: String(episode).padStart(2, '0'),
			TITLE: episodeDescription.title,
		}
		//let targetPlexFileName = `${environment.PLEX_SERIES_NAME} - S${String(arc).padStart(2, '0')}E${String(episode).padStart(2, '0')} - ${episodeDescription.title}.mkv`
		let targetPlexFileName = format.replace(/\{(\w+)\}/g, (match, key) => {
			if (!(key in variables)) {
				throw new Error(`Unknown placeholder in PLEX_FILENAME_FORMAT: {${key}}`)
			}
			return variables[key]
		})
		targetPlexFileName = targetPlexFileName.replace(/(\.mkv)*$/, '.mkv')
		let targetPlexPath = `${plexLibraryPath}${plexSeparator}${environment.PLEX_SERIES_FOLDER_NAME}${plexSeparator}Season ${String(arc).padStart(2, '0')}${plexSeparator}`

		return {
			targetPlexFileName,
			targetPlexPath,
		}
	}
}
