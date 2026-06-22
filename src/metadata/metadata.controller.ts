import axios from 'axios'
import { copyFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import path from 'path'
import { js2xml } from 'xml-js'
import environment from '../environment.js'
import { TargetLibraryFile } from '../library/library.model.js'
import { Context } from '../util/context.js'
import getFileCrc32Hash from '../util/crc32.js'
import { Filter } from '../util/filters.js'
import Logger from '../util/logger.js'
import {
	Episode,
	EpisodeDescription,
	Metadata,
	MetadataAbsentError,
	TorrentInfo,
} from './metada.model.js'
import { QueueDownloadResult } from '../torrent/torrent.model.js'

export class MetadataController {
	private metadata: Metadata
	private reprocess: boolean

	private TVShowNFO
	private seasonNFOs = {}
	private episodesNFOs = {}

	async refreshMetadata() {
		Logger.info(`Refreshing Metadata...`)

		let newMetadata = false
		try {
			let metadata = (await axios.get(environment.METADATA_URL)).data

			if (
				!this.metadata ||
				metadata.status.last_update > this.metadata.status.last_update
			) {
				Logger.info(`Newer Metadata found!`)
				this.metadata = metadata
				newMetadata = true
			} else if (this.reprocess) {
				Logger.info(`Reprocessing Metadata due to previous errors!`)
				this.reprocess = false
				newMetadata = true
			}
		} catch (e) {
			Logger.error(`Error refreshing Metadata, will retry...`)
			Logger.error(e)
		}

		try {
			if (newMetadata) await this.processMetadataEpisodes()
		} catch (e) {
			//TODO refactor checkMetadataDownloaded and create a queue of failedToProcess to only retry those
			Logger.error(
				`Unexpected error encountered when processing metadata, we will attempt to reprocess it again next cycle...`,
			)
			this.reprocess = true
		}
		if (newMetadata) await this.processMetadataEpisodes()

		setTimeout(async () => {
			await this.refreshMetadata()
		}, environment.METADATA_CHECK_INTERVAL)
	}

	async processMetadataEpisodes() {
		this.checkMetadataDownloaded()

		Logger.info(`Generating .nfo files...`)
		await this.generateTVShowNFO()
		await this.generateSeasonNFOs()
		await this.generateEpisodeNFOs()

		Logger.info(`Processing episodes from metadata...`)

		for (let arc of this.metadata.arcs[environment.METADATA_LANGUAGE]) {
			if (!Filter({ arc: arc.part })) continue

			if (arc.part == 0 && !environment.INCLUDE_SPECIALS) {
				Logger.info(`Skipping Specials as per env INCLUDE_SPECIALS...`)
				continue
			}

			Logger.info(`Processing Season ${arc.part}...`)
			for (let episode of arc.episodes) {
				if (!Filter({ arc: arc.part, episode: episode.episode })) continue

				Logger.debug(
					`Episode ${arc.part}-${String(episode.episode).padStart(2, '0')} - Processing`,
				)

				if (episode.standard == '702231E9') {
					Logger.debug(`Skypiea 14 manual correction`)
					episode.standard = '704F68EA'
				}

				let file = await Context.library.getExistingLibraryEpisodeFile(
					arc.part,
					Number.parseInt(episode.episode),
				)
				if (file) {
					if (environment.SKIP_VERIFY_PRESENT_FILES) {
						Logger.debug(
							`Episode ${arc.part}-${String(episode.episode).padStart(2, '0')} - Exist on Media Server (Verification skipped)...`,
						)
						if (!environment.SKIP_ORGANIZE_PRESENT_FILES) {
							await this.organizeFile(
								arc.part,
								Number.parseInt(episode.episode),
							)
						} else if (!environment.SKIP_UPDATE_METADATA_PRESENT_FILES) {
							await this.updatemetadata(
								arc.part,
								Number.parseInt(episode.episode),
							)
						}
						continue
					}

					Logger.debug(
						`Episode ${arc.part}-${String(episode.episode).padStart(2, '0')} - Exists on Media Server (Verifying)`,
					)

					Logger.debug(
						`Episode ${arc.part}-${String(episode.episode).padStart(2, '0')} - Hashing`,
					)
					let CRC32 = await getFileCrc32Hash(file)
					Logger.debug(
						`Episode ${arc.part}-${String(episode.episode).padStart(2, '0')} - Hash complete (${CRC32})`,
					)

					if (arc.part == 16 && Number.parseInt(episode.episode) == 25) {
						if (!environment.PREFER_G8) {
							Logger.debug(`Corrected 16. Skypiea 25 for alternate G-8 cut`)
							episode.standard = 'C951349C'
						}
					}

					if (environment.PREFER_EXTENDED && !!episode.extended) {
						if (CRC32 == episode.extended) {
							Logger.info(
								`Episode ${arc.part}-${String(episode.episode).padStart(2, '0')} - Already present`,
							)
							if (!environment.SKIP_ORGANIZE_PRESENT_FILES) {
								await this.organizeFile(
									arc.part,
									Number.parseInt(episode.episode),
								)
							} else if (!environment.SKIP_UPDATE_METADATA_PRESENT_FILES) {
								await this.updatemetadata(
									arc.part,
									Number.parseInt(episode.episode),
								)
							}
							continue
						} else if (CRC32 == episode.standard) {
							if (environment.SKIP_DOWNLOADS) {
								Logger.info(
									`Episode ${arc.part}-${String(episode.episode).padStart(2, '0')} - Standard instead of extended [Download skipped]`,
								)
							} else {
								const queueResult = await this.addToDownloadQueue(
									arc.part,
									episode.episode,
									true,
								)
								Logger.info(
									`Episode ${arc.part}-${String(episode.episode).padStart(2, '0')} - Standard instead of extended [${this.formatDownloadQueueStatus(queueResult)}]`,
								)
							}
						}
					} else if (CRC32 == episode.standard) {
						Logger.info(
							`Episode ${arc.part}-${String(episode.episode).padStart(2, '0')} - Already present`,
						)
						if (!environment.SKIP_ORGANIZE_PRESENT_FILES) {
							await this.organizeFile(
								arc.part,
								Number.parseInt(episode.episode),
							)
						} else if (!environment.SKIP_UPDATE_METADATA_PRESENT_FILES) {
							await this.updatemetadata(
								arc.part,
								Number.parseInt(episode.episode),
							)
						}
						continue
						} else {
							if (environment.SKIP_DOWNLOADS) {
								Logger.info(
									`Episode ${arc.part}-${String(episode.episode).padStart(2, '0')} - CRC32 Mismatch [Download skipped]`,
								)
							} else {
								const queueResult = await this.addToDownloadQueue(
									arc.part,
									episode.episode,
									environment.PREFER_EXTENDED && !!episode.extended,
								)
								Logger.info(
									`Episode ${arc.part}-${String(episode.episode).padStart(2, '0')} - CRC32 Mismatch [${this.formatDownloadQueueStatus(queueResult)}]`,
								)
							}
					}
				} else {
					if (environment.SKIP_DOWNLOADS) {
						Logger.info(
							`Episode ${arc.part}-${String(episode.episode).padStart(2, '0')} - Missing [Download skipped]`,
						)
					} else {
						const queueResult = await this.addToDownloadQueue(
							arc.part,
							episode.episode,
							environment.PREFER_EXTENDED && !!episode.extended,
						)
						Logger.info(
							`Episode ${arc.part}-${String(episode.episode).padStart(2, '0')} - Missing [${this.formatDownloadQueueStatus(queueResult)}]`,
						)
					}
				}
			}
		}
	}

	async organizeFile(arc: number, episode: number) {
		this.checkMetadataDownloaded()
		Logger.debug(
			`Episode ${arc}-${String(episode).padStart(2, '0')} - Verifying path format...`,
		)

		let libraryFile = await Context.library.getExistingLibraryEpisodeFile(
			arc,
			episode,
			true,
		)

		let episodeDescription = await Context.metadata.getEpisodeDescription(
			arc,
			episode,
		)
		let targetLibraryFile: TargetLibraryFile =
			await Context.library.getTargetLibraryEpisodeFile(
				arc,
				episode,
				episodeDescription,
			)

		if (
			libraryFile != `${targetLibraryFile.path}${targetLibraryFile.filename}`
		) {
			let serverFile = await Context.library.getExistingLibraryEpisodeFile(
				arc,
				episode,
			)
			let serverFolder = path.resolve(serverFile, '..')
			let serverFileName = serverFile.replace(`${serverFolder}${path.sep}`, '')

			let targetFolder = path.resolve(
				`${targetLibraryFile.path}`.replace(
					environment.MOUNT_LIBRARY_MEDIA_SERVER,
					environment.MOUNT_LIBRARY_ONEPACERR,
				),
			)
			let targetFile = path.resolve(
				`${targetLibraryFile.path}${targetLibraryFile.filename}`.replace(
					environment.MOUNT_LIBRARY_MEDIA_SERVER,
					environment.MOUNT_LIBRARY_ONEPACERR,
				),
			)

			Logger.info(
				`Episode ${arc}-${String(episode).padStart(2, '0')} - File on Media Server with wrong format, renaming...`,
			)
			mkdirSync(targetFolder, {
				recursive: true,
			})

			let filesInFolder = readdirSync(serverFolder).filter(
				f => f != serverFileName,
			)
			let trashFiles = filesInFolder.filter(f => {
				return (
					f.replace(/\.(nfo|mkv)$/, '') ==
						serverFileName.replace(/\.mkv$/, '') ||
					(f.includes(environment.LIBRARY_SERIES_NAME) &&
						f.includes(
							`S${String(arc).padStart(2, '0')}E${String(episode).padStart(2, '0')}`,
						))
				)
			})

			copyFileSync(serverFile, targetFile)

			await Context.library.scanLibrary(targetLibraryFile.path, arc)

			unlinkSync(serverFile)
			if (trashFiles.length > 0)
				Logger.info(
					`Episode ${arc}-${String(episode).padStart(2, '0')} - Cleaning ${trashFiles.length} trash files...`,
				)
			for (let t of trashFiles) {
				unlinkSync(path.resolve(serverFolder, t))
			}

			await Context.library.scanLibrary(
				libraryFile.replace(/[\\/]+[^\\/]+$/, ''),
				arc,
			)
			await Context.library.updateEpisodeMetadata(
				arc,
				episode,
				episodeDescription.title,
				episodeDescription.description,
			)
		} else {
			Logger.debug(
				`Episode ${arc}-${String(episode).padStart(2, '0')} - Correctly formatted...`,
			)
			if (!environment.SKIP_UPDATE_METADATA_PRESENT_FILES) {
				await this.updatemetadata(arc, episode)
			}
		}
	}

	async updatemetadata(arc: number, episode: number) {
		this.checkMetadataDownloaded()
		Logger.debug(
			`Episode ${arc}-${String(episode).padStart(2, '0')} - Attempting Metadata Update`,
		)

		let episodeDescription = await Context.metadata.getEpisodeDescription(
			arc,
			episode,
		)
		let targetLibraryFile: TargetLibraryFile =
			await Context.library.getTargetLibraryEpisodeFile(
				arc,
				episode,
				episodeDescription,
			)

		await Context.library.scanLibrary(targetLibraryFile.path, arc)

		await Context.library.updateEpisodeMetadata(
			arc,
			episode,
			episodeDescription.title,
			episodeDescription.description,
		)
		await Context.library.updateSeasonMetadata(arc)
		await Context.library.updateShowMetadata()
	}

	getEpisodeDescription(arc: number, episode: number): EpisodeDescription {
		this.checkMetadataDownloaded()
		return this.metadata.descriptions[environment.METADATA_LANGUAGE].find(
			d => d.arc == arc && d.episode == episode,
		)
	}

	getSeasonDescription(arc: number) {
		this.checkMetadataDownloaded()
		return this.metadata.arcs[environment.METADATA_LANGUAGE].find(
			a => a.part === arc,
		)
	}

	getShowDescription() {
		this.checkMetadataDownloaded()
		return this.metadata.tvshow[environment.METADATA_LANGUAGE]
	}

	private async generateTVShowNFO() {
		this.checkMetadataDownloaded()

		let tvshow = JSON.parse(
			JSON.stringify(this.metadata.tvshow[environment.METADATA_LANGUAGE]),
		)
		let namedseason = this.metadata.arcs[environment.METADATA_LANGUAGE].map(
			a => {
				return {
					_attributes: {
						number: a.part,
					},
					_text: `${a.part > 0 ? `${a.part}. ` : ''}${a.title}`,
				}
			},
		)

		delete tvshow.customrating

		let path = await Context.library.getLibraryFolder()
		path += path.includes('/') ? '/' : '\\'
		path += environment.LIBRARY_SERIES_FOLDER_NAME
		path += path.includes('/') ? '/' : '\\'
		path += 'poster.png'

		tvshow.title = tvshow.title.replace('One Piece', 'One Pace')
		tvshow.originaltitle = tvshow.title
		tvshow.sorttitle = tvshow.title
		this.TVShowNFO = `<?xml version='1.0' encoding='utf-8'?>\n${js2xml(
			{
				tvshow: {
					...tvshow,
					outline: tvshow.plot,
					customrating:
						this.metadata.tvshow[environment.METADATA_LANGUAGE].customrating,
					lockdata: false,
					namedseason: namedseason,
					art: {
						poster: path,
					},
				},
			},
			{
				compact: true,
				ignoreComment: true,
				spaces: 2,
			},
		)}`
	}

	getTVShowNFO() {
		this.checkMetadataDownloaded()
		return this.TVShowNFO
	}

	private async generateSeasonNFOs() {
		this.checkMetadataDownloaded()

		let arcs = JSON.parse(
			JSON.stringify(this.metadata.arcs[environment.METADATA_LANGUAGE]),
		)

		for (let a of arcs) {
			let path = await Context.library.getLibraryFolder()
			path += path.includes('/') ? '/' : '\\'
			path += environment.LIBRARY_SERIES_FOLDER_NAME
			path += path.includes('/') ? '/' : '\\'
			path += `Season ${String(a.part).padStart(2, '0')}`
			path += path.includes('/') ? '/' : '\\'
			path += `poster.png`

			let NFO = `<?xml version='1.0' encoding='utf-8'?>\n${js2xml(
				{
					season: {
						title: a.part == 0 ? a.title : `${a.part}. ${a.title}`,
						sorttitle: a.part == 0 ? a.title : `${a.part}. ${a.title}`,
						seasonnumber: a.part,
						plot: a.description,
						outline: a.description,
						overview: a.description,
						customrating: 'TV-14',
						lockdata: false,
						art: {
							poster: path,
						},
					},
				},
				{
					compact: true,
					ignoreComment: true,
					spaces: 2,
				},
			)}`

			this.seasonNFOs[`${a.part}`] = NFO
		}
	}

	getSeasonNFO(arc: number) {
		this.checkMetadataDownloaded()
		return this.seasonNFOs[`${arc}`]
	}

	private async generateEpisodeNFOs() {
		this.checkMetadataDownloaded()

		let descriptions = JSON.parse(
			JSON.stringify(this.metadata.descriptions[environment.METADATA_LANGUAGE]),
		)
		this.episodesNFOs = {}

		for (let ed of descriptions) {
			let NFO = `<?xml version='1.0' encoding='utf-8'?>\n${js2xml(
				{
					episodedetails: {
						title: ed.title,
						//////////////////
						//Implement when Jellyfin updates to allow for multiple versions of an episode
						//Not sure if it's gonna be called displayversion, that's the one for movies
						//displayversion: Standard/Extended/G-8
						////////////////
						originaltitle: ed.title,
						sorttitle: ed.title,

						plot: ed.description,

						showtitle: environment.LIBRARY_SERIES_NAME,

						season: ed.arc,
						displayseason: ed.arc,
						episode: ed.episode,
						displayepisode: ed.episode,

						customrating: 'TV-14',
						lockdata: false,
					},
				},
				{
					compact: true,
					ignoreComment: true,
					spaces: 2,
				},
			)}`

			if (!this.episodesNFOs[`${ed.arc}`]) this.episodesNFOs[`${ed.arc}`] = {}
			this.episodesNFOs[`${ed.arc}`][`${ed.episode}`] = NFO
		}
	}

	getEpisodeNFO(arc: number, episode: number) {
		this.checkMetadataDownloaded()
		return this.episodesNFOs[`${arc}`][`${episode}`]
	}

	async addToDownloadQueue(
		arc: number,
		episode: string | number,
		extended?: boolean,
	): Promise<QueueDownloadResult> {
		this.checkMetadataDownloaded()

		let rsstitle = `${
			this.metadata.arcs[environment.METADATA_LANGUAGE].find(
				a => a.part === arc,
			).title
		} ${String(episode).padStart(2, '0')}${extended ? ` Extended Cut` : ''}`

		if (rsstitle.startsWith(`Skypiea 25`)) {
			Logger.debug('Manual correction for 16. Skypeiea 25 Alternate G-8')
			rsstitle = environment.PREFER_G8
				? 'Skypiea 25 Alternate Cut (G-8)'
				: 'Skypiea 25'
		}

		let torrentInfo: TorrentInfo
		try {
			torrentInfo = await Context.rss.getTorrentInfo(rsstitle)
		} catch (e) {
			Logger.debug(`Couldn't find MagnetURI in RSS, refreshing it...`)
			await Context.rss.fetch()
			torrentInfo = await Context.rss.getTorrentInfo(rsstitle)
		}

		return await Context.torrent.queueDownload(torrentInfo)
	}

	private formatDownloadQueueStatus(result: QueueDownloadResult): string {
		switch (result) {
			case 'added':
				return 'Download queued'
			case 'already_present':
				return 'Torrent already in client'
			case 'skipped':
				return 'Download skipped'
		}
	}

	getEpisodeUpdatedCRC32(arc: number, episode: number): string {
		this.checkMetadataDownloaded()

		let target = this.metadata.arcs[environment.METADATA_LANGUAGE]
			.find(a => a.part === arc)
			.episodes.find(e => Number.parseInt(e.episode) == episode)
		return environment.PREFER_EXTENDED && !!target.extended
			? target.extended
			: target.standard
	}

	getEpisodeFromCRC32(CRC32: string): Episode {
		this.checkMetadataDownloaded()

		let episode = this.metadata.episodes[CRC32]
		if (!episode) {
			if (CRC32 == '704F68EA') {
				Logger.debug(`Skypiea 14 manual correction`)
				return { arc: 16, episode: 14 }
			}
			Logger.warn(
				`CRC32 ${CRC32} not in metadata... Probably just an out of date release included in a batch...`,
			)
			throw new Error(`CRC32 ${CRC32} not in metadata...`)
		}
		return episode
	}

	private checkMetadataDownloaded() {
		if (!this.metadata) {
			Logger.warn(`Metadata missing, something went wrong with import...`)
			throw new MetadataAbsentError()
		}
	}
}
