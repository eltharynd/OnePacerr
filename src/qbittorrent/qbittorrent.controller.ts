import { QBittorrent, Torrent, TorrentCategories } from '@ctrl/qbittorrent'
import environment from '../environment.js'
import Logger from '../util/logger.js'
import path from 'node:path'
import { copyFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { Context } from '../util/context.js'

export class qBittorrentController {
	private client: QBittorrent

	constructor() {
		this.client = new QBittorrent({
			baseUrl: environment.TORRENT_URL,
			username: environment.TORRENT_USER,
			password: environment.TORRENT_PASSWORD,
		})
		setTimeout(() => {
			this.processCompleted()
		}, environment.TORRENT_CHECK_INTERVAL)
	}

	public async queueDownload(torrentInfo: {
		magnetURI: string
		infoHash: string
	}) {
		Logger.info(`Adding magnetURI to qBittorrent...`)
		let torrents = await this.client.listTorrents()
		let present = torrents.find(t => t.hash === torrentInfo.infoHash)
		if (present) {
			Logger.debug(`MagnetURI already in qBittorrent...`)
			return
		} else
			await this.client.addMagnet(torrentInfo.magnetURI, {
				category: environment.TORRENT_CATEGORY,
			})
	}

	public async processCompleted() {
		Logger.info(`Checking completed torrents`)

		try {
			let torrents = await this.client.listTorrents()
			let completed = torrents.filter(
				t => t.category === environment.TORRENT_CATEGORY && t.progress >= 1,
			)
			if (completed.length > 0)
				Logger.info(`Importing ${completed.length} completed torrents...`)
			for (let torrent of completed) {
				await this.import(torrent)
			}
		} catch (e) {
			Logger.error(`Error processing completed downloads`)
			Logger.error(e)
		} finally {
			setTimeout(async () => {
				await this.processCompleted()
			}, environment.TORRENT_CHECK_INTERVAL)
		}
	}

	public async import(torrent: Torrent) {
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
					continue
				}
				let episodeDescription = await Context.metadata.getEpisodeDescription(
					episode.arc,
					episode.episode,
				)

				let plexLibraryPath = await Context.plex.getLibraryFolder()

				let plexSeparator = plexLibraryPath.includes('/') ? '/' : '\\'

				let targetPlexFileName = `${environment.PLEX_SERIES_NAME} - S${String(episode.arc).padStart(2, '0')}E${String(episode.episode).padStart(2, '0')} - ${episodeDescription.title}.mkv`
				let targetPlexPath = `${plexLibraryPath}${plexSeparator}${environment.PLEX_SERIES_NAME}${plexSeparator}Season ${String(episode.arc).padStart(2, '0')}${plexSeparator}`

				let previousPlexFileName

				try {
					let existingPlexFiles = readdirSync(
						path.resolve(
							targetPlexPath.replace(
								environment.MOUNT_LIBRARY_PLEX,
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
						environment.MOUNT_LIBRARY_PLEX,
						environment.MOUNT_LIBRARY_ONEPACERR,
					),
				)
				const destination = path.resolve(
					`${targetPlexPath}${targetPlexFileName}`.replaceAll(
						environment.MOUNT_LIBRARY_PLEX,
						environment.MOUNT_LIBRARY_ONEPACERR,
					),
				)

				if (previousPlexFileName) {
					const toDelete = path.resolve(
						`${targetPlexPath}${previousPlexFileName}`.replaceAll(
							environment.MOUNT_LIBRARY_PLEX,
							environment.MOUNT_LIBRARY_ONEPACERR,
						),
					)
					try {
						unlinkSync(sanitizeWindowsFileName(toDelete))
						Logger.debug(
							`Pre-existing file for ${episode.arc}-${episode.episode} deleted`,
						)
					} catch (e) {
						Logger.error(
							`Couldn't delete '${previousPlexFileName}', it probably has been deleted already but plex didn't scan the library...`,
						)
					}
				}

				Logger.debug(`Copying file for ${episode.arc}-${episode.episode}`)

				mkdirSync(sanitizeWindowsFileName(destinationFolder), {
					recursive: true,
				})
				copyFileSync(
					sanitizeWindowsFileName(source),
					sanitizeWindowsFileName(destination),
				)
				Logger.info(
					`File for ${episode.arc}-${episode.episode} imported successfully`,
				)

				await Context.metadata.updatemetadata(episode.arc, episode.episode)
			} else {
				Logger.error(`No CRC32 found in file name: ${file}`)
			}
		}

		let categories: TorrentCategories = await this.client.getCategories()
		if (!categories[environment.TORRENT_CATEGORY_ONCE_COMPLETED]) {
			Logger.info(
				`Creating '${environment.TORRENT_CATEGORY_ONCE_COMPLETED}' qBittorrent category`,
			)
			await this.client.createCategory(
				environment.TORRENT_CATEGORY_ONCE_COMPLETED,
			)
		}
		await this.client.setTorrentCategory(
			torrent.hash,
			environment.TORRENT_CATEGORY_ONCE_COMPLETED,
		)
	}
}

function sanitizeWindowsFileName(fileName: string): string {
	return fileName
		.replace(/"/g, '“') // Replace straight double quotes with curly ones
		.replace(/:/g, ' -') // Replace colons with a dash (common for subtitles/arcs)
		.replace(/[*?<>|]/g, '') // Remove other illegal characters completely
}
