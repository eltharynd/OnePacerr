import { copyFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import environment from '../environment.js'
import { TorrentInfo } from '../metadata/metada.model.js'
import { Context } from '../util/context.js'
import Logger from '../util/logger.js'
import sanitizeWindowsFileName from '../util/sanitizeWindowsFilename.js'
import { qBittorrentController } from './clients/qbittorrent.controller.js'
import { ITorrentClient, Torrent, TorrentClient } from './torrent.model.js'

export class TorrentController {
	private client: ITorrentClient
	private __watching: boolean = false

	constructor() {
		if (environment.SKIP_DOWNLOADS) return

		switch (environment.TORRENT_CLIENT as TorrentClient) {
			case 'qbittorrent':
				this.client = new qBittorrentController({
					baseUrl: environment.TORRENT_URL,
					username: environment.TORRENT_USER,
					password: environment.TORRENT_PASSWORD,
				})
				break
			case 'utorrent':
			case 'deluge':
			default:
				Logger.error(
					`Torrent client '${environment.TORRENT_CLIENT}' not implemented yet...`,
				)
				throw new Error()
		}
	}

	public async startWatching() {
		if (environment.SKIP_DOWNLOADS) return

		if (!this.__watching) {
			this.__watching = true
			Logger.info(
				`Starting to monitor ${this.client.torrentClient} for completed downloads...`,
			)
			await this.processCompletedTorrents()
		}
	}

	public async queueDownload(torrentInfo: TorrentInfo) {
		if (environment.SKIP_DOWNLOADS) {
			Logger.info(`Downloads disabled by env vars`)
			return
		}

		Logger.debug(`Adding magnetURI to ${this.client.torrentClient}...`)
		let torrents = await this.client.getAllTorrents()
		if (torrents.find(t => t.hash === torrentInfo.infoHash)) {
			Logger.debug(`Torrent already in ${this.client.torrentClient}...`)
			return
		} else
			await this.client.addTorrent(torrentInfo, environment.TORRENT_CATEGORY)
	}

	private async processCompletedTorrents() {
		Logger.debug(`Checking completed torrents`)

		try {
			let completed = await this.client.getCompletedTorrents(
				environment.TORRENT_CATEGORY,
			)
			if (completed.length > 0)
				Logger.info(`Importing ${completed.length} completed torrents...`)
			for (let torrent of completed) {
				await this.importTorrentFiles(torrent as Torrent)
			}
		} catch (e) {
			Logger.error(`Error processing completed downloads`)
			Logger.error(e)
		} finally {
			setTimeout(async () => {
				await this.processCompletedTorrents()
			}, environment.TORRENT_CHECK_INTERVAL)
		}
	}

	//TODO refactor this method to be more maintainable
	private async importTorrentFiles(torrent: Torrent) {
		let _path = path.resolve(
			torrent.content_path.replace(
				environment.MOUNT_DOWNLOADS_QBITTORRENT,
				environment.MOUNT_DOWNLOADS_ONEPACERR,
			),
		)

		let files: string[] = []

		if (_path.endsWith('.mkv')) files = [_path]
		else {
			for (let f of readdirSync(_path).filter(f => f.endsWith('.mkv'))) {
				let fullPath = `${torrent.content_path}${torrent.content_path.includes('/') ? '/' : '\\'}${f}`
				files.push(
					path.resolve(
						fullPath.replace(
							environment.MOUNT_DOWNLOADS_QBITTORRENT,
							environment.MOUNT_DOWNLOADS_ONEPACERR,
						),
					),
				)
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

				let episode
				try {
					episode = await Context.metadata.getEpisodeFromCRC32(CRC32)
				} catch (e) {
					Logger.debug(
						`File '${file}' is not most up to date (probably part of an outdated batch)... Skipping import`,
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

				let { targetPlexPath, targetPlexFileName } =
					await Context.plex.getTargetPlexFullPath(episode.arc, episode.episode)

				let previousPlexFileName

				try {
					let existingPlexFiles = readdirSync(
						path.resolve(
							targetPlexPath.replace(
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
						if (episodeNumber == episode.episode) {
							previousPlexFileName = existingFile
						}
					}
				} catch (e) {
					Logger.debug('File did not exist on plex...')
				}

				const source = file
				const destinationFolder = path.resolve(
					`${targetPlexPath}`.replaceAll(
						environment.MOUNT_LIBRARY_MEDIA_SERVER,
						environment.MOUNT_LIBRARY_ONEPACERR,
					),
				)
				const destination = path.resolve(
					`${targetPlexPath}${targetPlexFileName}`.replaceAll(
						environment.MOUNT_LIBRARY_MEDIA_SERVER,
						environment.MOUNT_LIBRARY_ONEPACERR,
					),
				)

				if (previousPlexFileName) {
					const toDelete = path.resolve(
						`${targetPlexPath}${previousPlexFileName}`.replaceAll(
							environment.MOUNT_LIBRARY_MEDIA_SERVER,
							environment.MOUNT_LIBRARY_ONEPACERR,
						),
					)
					try {
						unlinkSync(sanitizeWindowsFileName(toDelete))
						Logger.debug(
							`Pre-existing file for ${episode.arc}-${String(episode.episode).padStart(2, '0')} deleted`,
						)
					} catch (e) {
						Logger.error(
							`Couldn't delete '${previousPlexFileName}', it probably has been deleted already but plex didn't scan the library...`,
						)
					}
				}

				Logger.debug(
					`Copying file for ${episode.arc}-${String(episode.episode).padStart(2, '0')}`,
				)

				mkdirSync(sanitizeWindowsFileName(destinationFolder), {
					recursive: true,
				})
				copyFileSync(
					sanitizeWindowsFileName(source),
					sanitizeWindowsFileName(destination),
				)

				Logger.info(
					`File for ${episode.arc}-${String(episode.episode).padStart(2, '0')} imported successfully`,
				)

				await Context.metadata.updatemetadata(episode.arc, episode.episode)
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
