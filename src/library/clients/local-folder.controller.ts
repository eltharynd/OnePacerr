import { Logger } from 'ez-ts-logger'
import { existsSync, mkdirSync, readdirSync } from 'fs'
import path from 'path'
import environment from '../../environment.js'
import { EpisodeMetadata } from '../../metadata/metadata.model.js'
import sanitizeWindowsFileName from '../../util/sanitize-windows-filename.js'
import { LibraryController } from '../library.controller.js'
import {
	ILibraryController,
	LibraryClient,
	TargetLibraryFile,
} from '../library.model.js'

export class LocalFolderController implements ILibraryController {
	libraryClient: LibraryClient = 'none'

	private showFolder

	constructor(options: { root: string }) {
		if (!options.root) {
			throw new Error(`Local Folder misconfigured`)
		}

		this.showFolder = path.resolve(
			`${options.root}`,
			environment.LIBRARY_SERIES_FOLDER_NAME,
		)
	}

	init() {
		mkdirSync(this.showFolder, { recursive: true })
	}

	getLibraryFolder() {
		return this.showFolder
	}

	async getExistingLibraryEpisodeFile(
		episode: EpisodeMetadata,
		pathAccordingToMediaServer?: boolean,
	): Promise<string> {
		let targetPath = path.resolve(
			this.showFolder,
			`Season ${String(episode.arc).padStart(2, '0')}`,
		)
		mkdirSync(targetPath, { recursive: true })

		let targetFileName = LibraryController.resolveEpisodeTargetFileName(
			episode.arc,
			episode.episode,
			episode.title,
		)

		let file = path.resolve(targetPath, targetFileName)

		if (existsSync(file)) return file

		let files = readdirSync(targetPath).filter(
			f => f.endsWith(`.mkv`) || f.endsWith(`.mp4`),
		)
		if (files.length < 1) return null

		file = files.find(f =>
			f.includes(
				`S${String(episode.arc).padStart(2, '0')}E${String(episode.episode).padStart(2, '0')}`,
			),
		)
		if (file) return path.resolve(targetPath, file)

		file = files.find(f =>
			f.includes(
				`S${String(episode.arc).padStart(2, '0')}-E${String(episode.episode).padStart(2, '0')}`,
			),
		)
		if (file) return path.resolve(targetPath, file)

		file = files.find(f =>
			f.includes(
				`${String(episode.arc).padStart(2, '0')}-${String(episode.episode).padStart(2, '0')}`,
			),
		)
		if (file) return path.resolve(targetPath, file)

		return null
	}

	async getTargetLibraryEpisodeFile(
		episode: EpisodeMetadata,
	): Promise<TargetLibraryFile> {
		let targetPath = `${path.resolve(
			this.showFolder,
			`Season ${String(episode.arc).padStart(2, '0')}`,
		)}${path.sep}`
		let targetFileName = LibraryController.resolveEpisodeTargetFileName(
			episode.arc,
			episode.episode,
			episode.title,
		)

		return {
			path: targetPath,
			filename: sanitizeWindowsFileName(targetFileName),
		}
	}

	scanLibrary(folder: string, arc: number) {
		Logger.debug(`No need to scan Local Folder Library`)
	}

	updateEpisodeMetadata(episode: EpisodeMetadata) {
		Logger.debug(`updateEpisodeMetadata`)
	}

	updateSeasonMetadata(arc: number) {
		Logger.debug(`updateSeasonMetadata`)
	}

	updateShowMetadata() {
		Logger.debug(`updateShowMetadata`)
	}
}
