import { MediaPart, PlexServer, Show, ShowSection } from '@ctrl/plex'
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import WebSocket from 'ws'
import environment from '../environment.js'
import { Context } from '../util/context.js'
import Logger from '../util/logger.js'
import resolvePosterPath from '../util/resolvePosterPath.js'
import sanitizeWindowsFileName from '../util/sanitizeWindowsFilename.js'
import {
	ILibraryController,
	LibraryClient,
	TargetLibraryFile,
} from './library.model.js'
import { PlexController } from './plex/plex.controller.js'

export class LibraryController {
	private client: ILibraryController

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

	async getEpisodeFile(
		season: number,
		episode: number,
		pathAccordingToMediaServer?: boolean,
	) {
		return this.client.getEpisodeFilePath(
			season,
			episode,
			pathAccordingToMediaServer,
		)
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

	async getTargetLibraryPath(
		arc: number,
		episode: number,
		episodeDescription?: { title: string; description: string },
	): Promise<TargetLibraryFile> {
		return this.client.getTargetLibraryPath(arc, episode, episodeDescription)
	}
}
