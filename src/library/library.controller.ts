import { MediaPart, PlexServer, Show, ShowSection } from '@ctrl/plex'
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import WebSocket from 'ws'
import environment from '../environment.js'
import { Context } from '../util/context.js'
import Logger from '../util/logger.js'
import resolvePosterPath from '../util/resolvePosterPath.js'
import sanitizeWindowsFileName from '../util/sanitizeWindowsFilename.js'
import { ILibraryController, LibraryClient } from './library.model.js'
import { PlexController } from './plex/plex.controller.js'

export class LibraryController {
	private client: ILibraryController
	// private ws

	// private server: PlexServer
	// private section: ShowSection
	// private show: Show

	constructor() {
		switch (environment.LIBRARY_MEDIA_SERVER as LibraryClient) {
			case 'plex':
				this.client = new PlexController({
					url: environment.PLEX_URL,
					token: environment.PLEX_TOKEN,
				})
				break
			case 'none':
			case 'jellyfin':
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

	async getEpisodeFile(season: number, episode: number, purePlex?: boolean) {
		return this.client.getEpisodeFile(season, episode, purePlex)
	}

	async getLibraryFolder() {
		return this.client.getLibraryFolder()
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

	async getTargetPlexFullPath(
		arc: number,
		episode: number,
		episodeDescription?: { title: string; description: string },
	): Promise<{ targetPlexFileName: string; targetPlexPath: string }> {
		return this.client.getTargetPlexFullPath(arc, episode, episodeDescription)
	}
}
