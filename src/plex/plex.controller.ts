import {
	Episode,
	MediaPart,
	PlexServer,
	Section,
	Show,
	ShowSection,
} from '@ctrl/plex'
import path from 'path'
import environment from '../environment.js'
import Logger from '../util/logger.js'
import { Context } from '../util/context.js'
import { readFileSync } from 'fs'
import WebSocket from 'ws'

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

		Logger.info(
			`Found Plex Library '${this.section.title}' with id '${this.section.uuid}'...`,
		)

		await this.fetchShow()
	}

	private async fetchShow() {
		Logger.info(`Searching for Plex Series...`)

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

		if (searchResults[0]) this.show = searchResults[0]
	}

	async getEpisodeFile(season: number, episode: number) {
		let _episode
		try {
			_episode = await this.show.episode({ season: season, episode: episode })
		} catch (e) {
			Logger.info(`Episode ${season}-${episode} does not exists on plex...`)
			return null
		}

		if (_episode.media.length < 1 || _episode.media[0].parts.length < 1) {
			Logger.info(`Episode ${season}-${episode} exists on plex with no file...`)
			return null
		}

		let part: MediaPart = _episode.media[0].parts[0]

		let file = path.resolve(
			part.file.replace(
				environment.MOUNT_LIBRARY_PLEX,
				environment.MOUNT_LIBRARY_ONEPACERR,
			),
		)
		return file
	}

	async getLibraryFolder() {
		return await this.section.locations.map(loc => loc.path)[0]
	}

	async scanLibrary(folder: string, arc: number) {
		Logger.debug(`Refreshing Library`)

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
							`${environment.PLEX_SERIES_NAME} - Season ${String(arc).padStart(2, '0')}` &&
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
		episodeNumber: number,
		title: string,
		description: string,
	) {
		Logger.debug(`Updating Medatada for episode ${arc}-${episodeNumber}`)
		let episode = await this.show.episode({
			season: arc,
			episode: episodeNumber,
		})

		await episode.editTitle(title)
		await episode.editSummary(description)
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

		Logger.debug(`Updating Season ${arc} poster in Plex...`)
		await season.uploadPoster({
			file: readFileSync(path.resolve(`./posters/${arc}/poster.png`)),
		})
		Logger.debug(`Metadata and poster for Season ${arc} updated...`)
	}

	async updateShowMetadata() {
		Logger.debug(`Updating Show Metadata in Plex...`)
		let description = await Context.metadata.getShowDescription()

		await this.show.editTitle(environment.PLEX_SERIES_NAME)
		await this.show.editSummary(description.plot)

		Logger.debug(`Updating Show poster in Plex...`)
		await this.show.uploadPoster({
			file: readFileSync(path.resolve(`./posters/poster.png`)),
		})
		Logger.debug(`Metadata and poster for Show updated...`)
	}
}
