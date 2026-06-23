import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import environment from '../environment.js'
import { TargetLibraryFile } from '../library/library.model.js'
import {
	Episode,
	MetadataAbsentError,
	TorrentInfo,
} from '../metadata/metada.model.js'
import { Context } from '../util/context.js'
import { Filter } from '../util/filters.js'
import Logger from '../util/logger.js'
import safeCopyFileSync from '../util/safe-copy-file.js'
import { DelugeController } from './clients/deluge.controller.js'
import { qBittorrentController } from './clients/qbittorrent.controller.js'
import {
	ITorrentController,
	QueueDownloadResult,
	Torrent,
	TorrentClient,
	TorrentConnectionError,
} from './torrent.model.js'

export class TorrentController {
	private client: ITorrentController

	private __watching: boolean = false
	private __handler

	constructor() {
		if (environment.PIPELINE_SKIP_DOWNLOADS) return

		switch (environment.TORRENT_CLIENT as TorrentClient) {
			case 'qbittorrent':
				this.client = new qBittorrentController({
					baseUrl: environment.TORRENT_URL,
					username: environment.TORRENT_USER,
					password: environment.TORRENT_PASSWORD,
				})
				break
			case 'deluge':
				this.client = new DelugeController({
					baseUrl: environment.TORRENT_URL,
					username: environment.TORRENT_USER,
					password: environment.TORRENT_PASSWORD,
				})
				break
			case 'utorrent':
			default:
				Logger.error(
					`Torrent client '${environment.TORRENT_CLIENT}' not implemented yet...`,
				)
				throw new Error()
		}
	}

	public async startWatching() {
		if (environment.PIPELINE_SKIP_DOWNLOADS) return

		if (!this.__watching) {
			Logger.info(
				`Starting to monitor ${this.client.torrentClient} for completed downloads...`,
			)

			this.__watching = true

			await this.monitorLoop()
		}
	}

	public async stoptWatching() {
		if (environment.PIPELINE_SKIP_DOWNLOADS) return

		if (this.__watching) {
			Logger.info(
				`Stopping to monitor ${this.client.torrentClient} for completed downloads...`,
			)

			this.__watching = false
			if (this.__handler) clearTimeout(this.__handler)
			this.__handler = null

			await this.processCompletedTorrents()
		}
	}

	public async monitorLoop() {
		if (!this.__watching) {
			if (this.__handler) clearTimeout(this.__handler)
			this.__handler = null
			return
		}

		Logger.debug(`Starting torrent processing loop`)
		if (Context.pipeline.isRunning()) {
			await Context.pipeline.waitForFinished()
		}

		try {
			await this.processCompletedTorrents()
		} catch (e) {
			Logger.error(
				`Download process error, will retry in ${environment.TORRENT_CHECK_INTERVAL / 1000} seconds...`,
			)
		} finally {
			if (this.__watching) {
				setTimeout(() => {
					this.monitorLoop()
				}, environment.TORRENT_CHECK_INTERVAL)
			}
		}
	}

	public async queueDownload(
		torrentInfo: TorrentInfo,
	): Promise<QueueDownloadResult> {
		if (environment.PIPELINE_SKIP_DOWNLOADS) {
			Logger.debug(`Downloads disabled by env vars`)
			return 'skipped'
		}

		Logger.debug(`Adding magnetURI to ${this.client.torrentClient}...`)
		let torrents = await this.client.getAllTorrents()
		if (torrents.find(t => t.hash === torrentInfo.infoHash)) {
			Logger.debug(`Torrent already in ${this.client.torrentClient}...`)
			return 'already_present'
		}

		await this.client.addTorrent(torrentInfo, environment.TORRENT_CATEGORY)
		return 'added'
	}

	private async processCompletedTorrents() {
		Logger.debug(`Checking completed torrents`)

		try {
			let completed = await this.client.getCompletedTorrents(
				environment.TORRENT_CATEGORY,
			)
			if (completed.length > 0)
				Logger.info(`Processing ${completed.length} completed torrents...`)
			for (let torrent of completed) {
				await this.importTorrentFiles(torrent as Torrent)
			}
		} catch (e) {
			if (e instanceof MetadataAbsentError) {
				Logger.warn(
					`Metadata still missing, cannot process completed torrents...`,
				)
			} else if (e instanceof TorrentConnectionError) {
				Logger.warn(
					`Torrent Client down, could not process completed download...`,
				)
			} else {
				Logger.error(`Error processing completed downloads`)
				Logger.error(e)
			}
		}
	}

	private mapDownloadPath(qbPath: string): string {
		return path.resolve(
			qbPath.replace(
				environment.MOUNT_DOWNLOADS_TORRENT,
				environment.MOUNT_DOWNLOADS_ONEPACERR,
			),
		)
	}

	private resolveTorrentContentPath(torrent: Torrent): string {
		const candidates = [torrent.content_path]
		if (torrent.save_path && torrent.name) {
			candidates.push(path.join(torrent.save_path, torrent.name))
		}

		for (const candidate of candidates) {
			const mapped = this.mapDownloadPath(candidate)
			if (existsSync(mapped)) {
				if (candidate !== torrent.content_path) {
					Logger.debug(
						`Resolved torrent content path to '${mapped}' (qBittorrent reported '${torrent.content_path}')`,
					)
				}
				return candidate
			}
		}

		return candidates[0]
	}

	//TODO refactor this method to be more maintainable
	private async importTorrentFiles(torrent: Torrent) {
		const contentPath = this.mapDownloadPath(
			this.resolveTorrentContentPath(torrent),
		)

		let files: string[] = []

		if (contentPath.endsWith('.mkv')) {
			files = [contentPath]
			Logger.debug(`Processing 1 torrent file...`)
		} else {
			let mkvs = readdirSync(contentPath).filter(f => f.endsWith('.mkv'))
			if (mkvs.length > 0)
				Logger.debug(`Processing ${mkvs.length} torrent files...`)
			for (let f of mkvs) {
				files.push(path.join(contentPath, f))
			}
		}

		for (let file of files) {
			let match = file.match(/\[([0-9A-F]{8})\]\.mkv$/i)

			if (!match && file.includes('316829437')) {
				match = file
					.replace('316829437', '964FB36B')
					.match(/\[([0-9A-F]{8})\]\.mkv$/i)
				Logger.debug(`Punk Hazard 13 manual correction attempt`)
			}
			if (match) {
				const CRC32 = match[1].toUpperCase()
				Logger.debug(`Parsed CRC32: ${CRC32}`)

				let episode: Episode
				try {
					episode = await Context.metadata.getEpisodeFromCRC32(CRC32)
				} catch (e) {
					if (e instanceof MetadataAbsentError) {
						throw e
					}
					Logger.debug(
						`File '${file}' is not most up to date (probably part of an outdated batch)... Skipping import`,
					)
					continue
				}

				if (!Filter(episode)) {
					Logger.debug(
						`File for S${String(episode.arc).padStart(2, '0')}E${String(episode.episode).padStart(2, '0')} skipped due to filters...`,
					)
					continue
				}

				let targetCRC32 = await Context.metadata.getEpisodeUpdatedCRC32(
					episode.arc,
					episode.episode,
				)

				if (targetCRC32 != CRC32) {
					Logger.debug(
						`File '${file}' is not most up to date (probably part of an outdated batch)... Skipping import`,
					)
					continue
				}

				let targetLibraryFile: TargetLibraryFile =
					await Context.library.getTargetLibraryEpisodeFile(
						episode.arc,
						episode.episode,
					)

				let previousLibraryFileName

				try {
					let existingPlexFiles = readdirSync(
						path.resolve(
							targetLibraryFile.path.replace(
								environment.MOUNT_LIBRARY_MEDIA_SERVER,
								environment.MOUNT_LIBRARY_ONEPACERR,
							),
						),
					)
					for (let existingFile of existingPlexFiles.filter(f =>
						f.endsWith('.mkv'),
					)) {
						let episodeNumber = existingFile
							.replace(/^.+S[0-9][0-9]E/, '')
							.replace(/\ .+$/, '')
						if (Number.parseInt(episodeNumber) == episode.episode) {
							previousLibraryFileName = existingFile
						}
					}
				} catch (e) {
					Logger.debug('File did not exist on plex...')
				}

				const source = file
				const destinationFolder = path.resolve(
					targetLibraryFile.path.replace(
						environment.MOUNT_LIBRARY_MEDIA_SERVER,
						environment.MOUNT_LIBRARY_ONEPACERR,
					),
				)
				const destination = path.resolve(
					destinationFolder,
					targetLibraryFile.filename,
				)

				Logger.debug(
					`File for ${episode.arc}-${String(episode.episode).padStart(2, '0')} detected`,
				)
				if (!environment.PIPELINE_SKIP_DOWNLOADS_IMPORTS) {
					if (previousLibraryFileName) {
						const toDelete = path.resolve(
							`${targetLibraryFile.path}${previousLibraryFileName}`.replaceAll(
								environment.MOUNT_LIBRARY_MEDIA_SERVER,
								environment.MOUNT_LIBRARY_ONEPACERR,
							),
						)
						try {
							unlinkSync(toDelete)
							Logger.debug(
								`Pre-existing file for ${episode.arc}-${String(episode.episode).padStart(2, '0')} deleted`,
							)
						} catch (e) {
							Logger.error(
								`Couldn't delete '${previousLibraryFileName}', it probably has been deleted already but plex didn't scan the library...`,
							)
						}
					}

					Logger.debug(
						`Copying file for ${episode.arc}-${String(episode.episode).padStart(2, '0')}`,
					)

					mkdirSync(destinationFolder, {
						recursive: true,
					})

					await safeCopyFileSync(source, destination)

					Logger.info(
						`File for ${episode.arc}-${String(episode.episode).padStart(2, '0')} imported successfully`,
					)
					await Context.pipeline.updatemetadata(
						episode.arc,
						episode.episode,
						true,
					)
				} else {
					Logger.info(
						`File for ${episode.arc}-${String(episode.episode).padStart(2, '0')} skipped due to 'PIPELINE_SKIP_DOWNLOADS_IMPORTS'...`,
					)
				}
			} else {
				Logger.error(`No CRC32 found in file name: ${file}`)
			}
		}

		await this.client.updateTorrentCategory(
			torrent,
			environment.TORRENT_CATEGORY_ONCE_COMPLETED,
		)
	}
}
