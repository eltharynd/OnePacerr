import axios from 'axios'
import environment from '../environment.js'
import Logger from '../util/logger.js'
import { Context } from '../util/context.js'
import getFileCrc32Hash from '../util/crc32.js'
import { env } from 'process'

export class MetadataController {
	private metadata: {
		status: {
			last_update: string
			last_update_ts: number
		}
		tvshow: any
		arcs: {
			[key: string]: {
				part: number
				saga: string
				title: string
				description: string
				episodes: {
					episode: string
					standard: string
					extended: string
				}[]
			}[]
		}
		descriptions: {
			[key: string]: {
				arc: number
				episode: number
				title: string
				description: string
			}[]
		}
		episodes: any
		other_edits: any
	}

	async refreshMetadata() {
		Logger.info(`Refreshing Metadata...`)
		let metadata = (await axios.get(environment.METADATA_URL)).data
		if (
			!this.metadata ||
			metadata.status.last_update > this.metadata.status.last_update
		) {
			Logger.info(`Newer Metadata found!`)
			this.metadata = (await axios.get(environment.METADATA_URL)).data
			await this.processEpisodes()
		}

		setTimeout(async () => {
			await this.refreshMetadata()
		}, environment.METADATA_CHECK_INTERVAL)
	}

	async processEpisodes() {
		Logger.info(`Processing episodes from metadata...`)
		for (let arc of this.metadata.arcs[environment.METADATA_LANGUAGE]) {
			if (arc.part === 0 && !environment.INCLUDE_SPECIALS) {
				Logger.info(`Skipping Specials as per env INCLUDE_SPECIALS...`)
				continue
			}

			Logger.info(`Processing Season ${arc.part}...`)

			for (let episode of arc.episodes) {
				Logger.debug(`Episode ${arc.part}-${episode.episode} - Processing`)

				if (episode.standard == '702231E9') {
					Logger.debug(`Skypiea 14 manual correction`)
					episode.standard = '704F68EA'
				}

				let file = await Context.plex.getEpisodeFile(
					arc.part,
					Number.parseInt(episode.episode),
				)
				if (file) {
					if (environment.SKIP_VERIFY_PRESENT_FILES) {
						Logger.debug(
							`Episode ${arc.part}-${episode.episode} - Exist on plex (Verification skipped)...`,
						)
						if (!environment.SKIP_UPDATE_METADATA_PRESENT_FILES) {
							await this.updatemetadata(
								arc.part,
								Number.parseInt(episode.episode),
							)
						}
						continue
					}

					Logger.debug(
						`Episode ${arc.part}-${episode.episode} - Exists on plex (Verifying)`,
					)

					Logger.debug(`Episode ${arc.part}-${episode.episode} - Hashing`)
					let CRC32 = await getFileCrc32Hash(file)
					Logger.debug(
						`Episode ${arc.part}-${episode.episode} - Hash complete (${CRC32})`,
					)

					if (environment.PREFER_EXTENDED && !!episode.extended) {
						if (CRC32 === episode.extended) {
							Logger.info(
								`Episode ${arc.part}-${episode.episode} - Already present`,
							)
							if (!environment.SKIP_UPDATE_METADATA_PRESENT_FILES) {
								await this.updatemetadata(
									arc.part,
									Number.parseInt(episode.episode),
								)
							}
							continue
						} else if (CRC32 === episode.standard) {
							Logger.info(
								`Episode ${arc.part}-${episode.episode} - Standard downloaded when extended request, adding to download queue...`,
							)
							await this.addToDownloadQueue(arc.part, episode.episode, true)
						}
					} else if (CRC32 === episode.standard) {
						Logger.info(
							`Episode ${arc.part}-${episode.episode} - Already present`,
						)
						if (!environment.SKIP_UPDATE_METADATA_PRESENT_FILES) {
							await this.updatemetadata(
								arc.part,
								Number.parseInt(episode.episode),
							)
						}
						continue
					} else {
						Logger.info(
							`Episode ${arc.part}-${episode.episode} - Missing, adding to download queue...`,
						)
						await this.addToDownloadQueue(
							arc.part,
							episode.episode,
							environment.PREFER_EXTENDED && !!episode.extended,
						)
					}
				} else {
					await this.addToDownloadQueue(
						arc.part,
						episode.episode,
						environment.PREFER_EXTENDED && !!episode.extended,
					)
				}
			}
		}
	}

	async updatemetadata(arc: number, episode: number) {
		Logger.info(
			`Episode ${arc}-${String(episode).padStart(2, '0')} - Updating Metadata`,
		)
		let episodeDescription = await Context.metadata.getEpisodeDescription(
			arc,
			episode,
		)

		let plexLibraryPath = await Context.plex.getLibraryFolder()

		let plexSeparator = plexLibraryPath.includes('/') ? '/' : '\\'

		let targetPlexFileName = `${environment.PLEX_SERIES_NAME} - S${String(arc).padStart(2, '0')}E${String(episode).padStart(2, '0')} - ${episodeDescription.title}.mkv`
		let targetPlexPath = `${plexLibraryPath}${plexSeparator}${environment.PLEX_SERIES_NAME}${plexSeparator}Season ${String(arc).padStart(2, '0')}${plexSeparator}`

		await Context.plex.scanLibrary(targetPlexPath, arc)

		await Context.plex.updateEpisodeMetadata(
			arc,
			episode,
			episodeDescription.title,
			episodeDescription.description,
		)
		await Context.plex.updateSeasonMetadata(arc)
		await Context.plex.updateShowMetadata()
	}

	getEpisodeDescription(
		arc: number,
		episode: number,
	): { title: string; description: string } {
		return this.metadata.descriptions[environment.METADATA_LANGUAGE].find(
			d => d.arc === arc && d.episode === episode,
		)
	}

	getSeasonDescription(arc: number) {
		return this.metadata.arcs[environment.METADATA_LANGUAGE].find(
			a => a.part === arc,
		)
	}

	getShowDescription() {
		return this.metadata.tvshow[environment.METADATA_LANGUAGE]
	}

	async addToDownloadQueue(
		arc: number,
		episode: string | number,
		extended?: boolean,
	) {
		let rsstitle = `${
			this.metadata.arcs[environment.METADATA_LANGUAGE].find(
				a => a.part === arc,
			).title
		} ${String(episode).padStart(2, '0')}${extended ? ` Extended Cut` : ''}`

		if (rsstitle == 'Skypiea 25') {
			Logger.debug('Manual correction for Alternate G-8')
			rsstitle = 'Skypiea 25 Alternate Cut (G-8)'
		}

		let torrentInfo
		try {
			torrentInfo = await Context.rss.getTorrentInfo(rsstitle)
		} catch (e) {
			Logger.debug(`Couldn't find MagnetURI in RSS, refreshing it...`)
			await Context.rss.fetch()
			torrentInfo = await Context.rss.getTorrentInfo(rsstitle)
		}

		await Context.torrent.queueDownload(torrentInfo)
	}

	async getEpisodeFromCRC32(CRC32: string) {
		let episode = this.metadata.episodes[CRC32]
		if (!episode) {
			if (CRC32 == '704F68EA') {
				Logger.debug(`Skypiea 14 manual correction`)
				return { arc: 16, episode: 14 }
			}
			Logger.error(`CRC32 ${CRC32} not in metadata...`)
			throw new Error(`CRC32 ${CRC32} not in metadata...`)
		}
		return episode
	}
}
