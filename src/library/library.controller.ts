import { Logger } from 'ez-ts-logger'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import environment from '../environment.js'
import { EpisodeMetadata } from '../metadata/metadata.model.js'
import { Context } from '../util/context.js'
import resolvePosterPath from '../util/resolve-poster-path.js'
import resolveSeasonPosterFileName from '../util/resolve-season-poster-filename.js'
import resolveSeriesRootFolder, {
	resolveSeasonFolder,
} from '../util/resolve-series-root-folder.js'
import safeCopyFileSync from '../util/safe-copy-file.js'
import sanitizeWindowsFileName from '../util/sanitize-windows-filename.js'
import { EmbyController } from './clients/emby.controller.js'
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
					baseUrl: environment.PLEX_URL,
					token: environment.PLEX_TOKEN,
				})
				break
			case 'jellyfin':
				this.client = new JellyfinController({
					baseUrl: environment.JELLYFIN_URL,
					username: environment.JELLYFIN_USERNAME,
					password: environment.JELLYFIN_PASSWORD,
				})
				break
			case 'emby':
				this.client = new EmbyController({
					baseUrl: environment.EMBY_URL,
					username: environment.EMBY_USERNAME,
					password: environment.EMBY_PASSWORD,
				})
				break
			default:
				Logger.error(
					`Media Server '${environment.LIBRARY_MEDIA_SERVER}' not implemented yet...`,
				)
				throw new Error()
		}
	}

	async init() {
		await this.client.init()
	}

	async getLibraryFolder() {
		return this.client.getLibraryFolder()
	}

	async getExistingLibraryEpisodeFile(
		episode: EpisodeMetadata,
		pathAccordingToMediaServer?: boolean,
	): Promise<string> {
		return await this.client.getExistingLibraryEpisodeFile(
			episode,
			pathAccordingToMediaServer,
		)
	}

	async getTargetLibraryEpisodeFile(
		episode: EpisodeMetadata,
	): Promise<TargetLibraryFile> {
		return await this.client.getTargetLibraryEpisodeFile(episode)
	}

	async scanLibrary(folder: string, arc: number) {
		let libraryFolder = resolveSeriesRootFolder(await this.getLibraryFolder())

		mkdirSync(
			`${path.resolve(`${libraryFolder.replace(environment.MOUNT_LIBRARY_MEDIA_SERVER, environment.MOUNT_LIBRARY_ONEPACERR)}`)}${path.sep}`,
			{ recursive: true },
		)

		if (
			this.client.libraryClient != 'plex' &&
			environment.PLEX_PLEXMATCH_EVEN_IF_NOT
		) {
			let plexmatch = `show: ${environment.LIBRARY_SERIES_NAME}`
			writeFileSync(
				`${path.resolve(`${libraryFolder.replace(environment.MOUNT_LIBRARY_MEDIA_SERVER, environment.MOUNT_LIBRARY_ONEPACERR)}`)}${path.sep}.plexmatch`,
				plexmatch,
			)
		}

		if (
			this.client.libraryClient != 'plex' ||
			!environment.PLEX_SKIP_METADATA_FILES
		)
			writeFileSync(
				`${path.resolve(`${libraryFolder.replace(environment.MOUNT_LIBRARY_MEDIA_SERVER, environment.MOUNT_LIBRARY_ONEPACERR)}`)}${path.sep}tvshow.nfo`,
				Context.metadata.getTVShowNFO(),
			)

		await this.client.scanLibrary(folder, arc)
	}

	async updateEpisodeMetadata(episode: EpisodeMetadata) {
		if (
			this.client.libraryClient != 'plex' ||
			!environment.PLEX_SKIP_METADATA_FILES
		) {
			let folder = resolveSeasonFolder(
				await this.getLibraryFolder(),
				episode.arc,
			)

			mkdirSync(
				`${path.resolve(`${folder.replace(environment.MOUNT_LIBRARY_MEDIA_SERVER, environment.MOUNT_LIBRARY_ONEPACERR)}`)}${path.sep}`,
				{ recursive: true },
			)
			writeFileSync(
				`${path.resolve(`${folder.replace(environment.MOUNT_LIBRARY_MEDIA_SERVER, environment.MOUNT_LIBRARY_ONEPACERR)}`)}${path.sep}${sanitizeWindowsFileName(
					await LibraryController.resolveEpisodeTargetFileName(
						episode.arc,
						episode.episode,
						episode.title,
					),
				)
					.replace('.mkv', '.nfo')
					.replace('.mp4', '.nfo')}`,
				await Context.metadata.getEpisodeNFO(episode.arc, episode.episode),
			)
		}
		await this.client.updateEpisodeMetadata(episode)
	}

	async updateSeasonMetadata(arc: number) {
		if (
			this.client.libraryClient != 'plex' ||
			!environment.PLEX_SKIP_METADATA_FILES
		) {
			let folder = resolveSeasonFolder(await this.getLibraryFolder(), arc)
			let showFolder = path.resolve(
				resolveSeriesRootFolder(await this.getLibraryFolder()).replace(
					environment.MOUNT_LIBRARY_MEDIA_SERVER,
					environment.MOUNT_LIBRARY_ONEPACERR,
				),
			)

			mkdirSync(
				`${path.resolve(`${folder.replace(environment.MOUNT_LIBRARY_MEDIA_SERVER, environment.MOUNT_LIBRARY_ONEPACERR)}`)}${path.sep}`,
				{ recursive: true },
			)
			writeFileSync(
				`${path.resolve(`${folder.replace(environment.MOUNT_LIBRARY_MEDIA_SERVER, environment.MOUNT_LIBRARY_ONEPACERR)}`)}${path.sep}season.nfo`,
				await Context.metadata.getSeasonNFO(arc),
			)
			if (!environment.PIPELINE_SKIP_POSTERS) {
				if (this.client.libraryClient === 'none') {
					mkdirSync(showFolder, { recursive: true })
					await safeCopyFileSync(
						resolvePosterPath({ arc }),
						`${showFolder}${path.sep}${resolveSeasonPosterFileName(arc)}`,
					)
				} else {
					await safeCopyFileSync(
						resolvePosterPath({ arc }),
						`${path.resolve(`${folder.replace(environment.MOUNT_LIBRARY_MEDIA_SERVER, environment.MOUNT_LIBRARY_ONEPACERR)}`)}${path.sep}poster.png`,
					)
				}
			}
		}

		await this.client.updateSeasonMetadata(arc)
	}

	async updateShowMetadata() {
		if (
			this.client.libraryClient != 'plex' ||
			!environment.PLEX_SKIP_METADATA_FILES
		) {
			if (!environment.PIPELINE_SKIP_POSTERS) {
				let libraryFolder = path.resolve(
					resolveSeriesRootFolder(await this.getLibraryFolder()).replace(
						environment.MOUNT_LIBRARY_MEDIA_SERVER,
						environment.MOUNT_LIBRARY_ONEPACERR,
					),
				)

				mkdirSync(`${libraryFolder}${path.sep}`, { recursive: true })
				await safeCopyFileSync(
					resolvePosterPath(),
					`${libraryFolder}${path.sep}poster.png`,
				)
			}
		}

		await this.client.updateShowMetadata()
	}

	static resolveEpisodeTargetFileName(
		arc: number,
		episode: number,
		title: string,
	): string {
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

		if (targetFileName.endsWith('.mkv')) return targetFileName
		else if (targetFileName.endsWith('.mp4')) return targetFileName
		else return targetFileName.replace(/(\.mkv)*$/, '.mkv')
	}
}
