import { Logger } from 'ez-ts-logger'
import { EventEmitter } from 'node:events'
import { mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import environment from '../environment.js'
import { TargetLibraryFile } from '../library/library.model'
import { ArcMetadata, EpisodeMetadata } from '../metadata/metadata.model.js'
import { QueueDownloadResult } from '../torrent/torrent.model.js'
import { Context } from '../util/context.js'
import getFileCrc32Hash from '../util/crc32.js'
import safeCopyFileSync from '../util/safe-copy-file.js'
import {
	NoActivePipelineError,
	PipelineControllerConfig,
	PipelineNotDoneError,
	PipelineNotReadyError,
	PipelineReport,
} from './pipeline.model.js'

export class PipelineController {
	private report: PipelineReport
	private history: PipelineReport[] = []

	private eventEmitter: EventEmitter = new EventEmitter()

	constructor(private config: PipelineControllerConfig) {}

	isRunning(): boolean {
		return (
			this.report?.status &&
			this.report.status != 'DONE' &&
			this.report.status != 'ERRORED'
		)
	}

	async waitForFinished() {
		Logger.info(`Waiting for active pipeline to finish...`)

		return await new Promise<void>(resolve => {
			const listener = () => {
				this.eventEmitter.removeListener('done', listener)
				this.eventEmitter.removeListener('errored', listener)
				Logger.debug(`Active pipeline sending done event...`)
				resolve()
			}
			this.eventEmitter.addListener('done', listener)
			this.eventEmitter.addListener('errored', listener)
			const handler = setInterval(() => {
				if (!this.isRunning()) {
					Logger.debug(`Active pipeline sending done event...`)
					clearInterval(handler)
					resolve()
				}
			}, 1000)
		})
	}

	create() {
		if (this.report?.status) {
			switch (this.report.status) {
				case 'PRE':
				case 'READY':
					break
				case 'RUNNING':
					throw new PipelineNotDoneError('Pipeline Already Running')
					break
				case 'DONE':
				case 'ERRORED':
					this.history.push(this.report)
					this.report = new PipelineReport()
					this.eventEmitter.emit('pre')
			}
		} else {
			Logger.info(`Creating pipeline...`)
			this.report = new PipelineReport()
			this.eventEmitter.emit('pre')
		}
	}

	addMonitored(monitored: ArcMetadata[]) {
		if (this.report && this.report.status == 'RUNNING') {
			throw new PipelineNotDoneError('Pipeline not done')
		} else if (!this.report || this.report.status != 'PRE') {
			throw new NoActivePipelineError('Pipiline not initialized')
		}
		this.report.monitored.push(...monitored)
		this.report.monitoredEpisodes += monitored
			.map(a => a.episodes.length)
			.reduce((acc, curr) => acc + curr)
		this.report.status = 'READY'
	}

	async start() {
		if (!this.report || this.report.status != 'READY') {
			throw new PipelineNotReadyError('Pipeline not ready')
		}
		this.report.started = new Date()
		this.report.status = 'RUNNING'
		this.eventEmitter.emit('running')

		Logger.info('')
		Logger.info(`##################################`)
		Logger.info(`##################################`)
		Logger.info(`####                          ####`)
		Logger.info(`####     PIPELINE RUNNING     ####`)
		Logger.info(
			`####   (monitored ep: ${String(this.report.monitoredEpisodes).padEnd(3, ' ')} )   ####`,
		)
		Logger.info(`####                          ####`)
		Logger.info(`##################################`)
		Logger.info(`##################################`)
		Logger.info('')

		const successfull: { arc: number; episode: number }[] = []
		const failed: { arc: number; episode: number }[] = []

		for (let ma of this.report.monitored) {
			for (let me of ma.episodes) {
				try {
					await this.process(ma, me)
					successfull.push({ arc: ma.arc, episode: me.episode })
				} catch (e: any) {
					Logger.error(
						`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Error processing file, requeueing...`,
					)
					Logger.error(e)
					failed.push({ arc: ma.arc, episode: me.episode })
				}
			}
		}

		if (successfull.length >= this.report.monitoredEpisodes) {
			this.report.ended = new Date()
			this.report.status = 'DONE'
			this.eventEmitter.emit('done')
		} else {
			const current = this.report
			current.ended = new Date()
			current.status = 'ERRORED'
			this.history.push(current)

			const next = new PipelineReport()
			this.eventEmitter.emit('pre')

			let failedArcs: { arc: number; episodes: number[] }[] = []
			for (let ep of failed) {
				let arc: any = failedArcs.find(a => a.arc == ep.arc)
				if (!arc) {
					arc = { arc: ep.arc, episodes: [ep.episode] }
					failedArcs.push(arc)
				} else {
					arc.episodes.push(ep.episode)
				}
			}

			let formattedFailed: ArcMetadata[] = current.monitored.filter(ma =>
				failedArcs.find(fa => fa.arc == ma.arc),
			)
			for (let a of formattedFailed) {
				const failed = failedArcs.find(fa => fa.arc == a.arc).episodes

				const all = current.monitored.find(ma => ma.arc == a.arc).episodes
				const filtered = all.filter(me => failed.includes(me.episode))

				a.episodes = filtered
			}
			next.monitored.push(...formattedFailed)
			next.monitoredEpisodes += formattedFailed
				.map(a => a.episodes.length)
				.reduce((acc, curr) => acc + curr)
			next.status = 'READY'

			this.report = next

			this.eventEmitter.emit('errored')
			setTimeout(() => {
				Context.pipeline.start()
			}, this.config.PIPELINE_RETRY_INTERVAL)
		}

		if (failed.length > 0) {
			Logger.warn(``)
			Logger.warn(`##################################`)
			Logger.warn(
				`#### Pipeline had ${failed.length}${String('####').padStart(16 - String(failed.length).length, ' ')}`,
			)
			Logger.warn(`#### Will retry next cycle    ####`)
			Logger.warn(`##################################`)
			Logger.warn(``)
		} else {
			Logger.info(``)
			Logger.info(`##################################`)
			Logger.info(``)
		}
		await Context.torrent.startWatching()
	}

	async updatemetadata(arc: number, episode: number, suppressLog?: boolean) {
		Context.metadata.checkMetadataDownloaded()
		Logger.debug(
			`S${arc}E${String(episode).padStart(2, '0')} - Attempting Metadata Update`,
		)

		let episodeDescription = await Context.metadata.getEpisode(arc, episode)
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
		Logger[suppressLog ? 'debug' : 'info'](
			`S${arc}E${String(episode).padStart(2, '0')} - Exists on Media Server (Metadata refreshed)`,
		)
	}

	getConfig() {
		const monitored = Context.metadata.getMonitored()
		return {
			config: this.config,
			monitored: monitored
				? {
						seasons: monitored.length,
						episodes: monitored
							.map(a => a.episodes.length)
							.reduce((acc, curr) => acc + curr),
					}
				: null,
			report: this.report,
		}
	}

	getReport() {
		return this.report
	}

	private async addToDownloadQueue(
		episode: EpisodeMetadata,
		extended?: boolean,
	): Promise<QueueDownloadResult> {
		if (episode.files?.alternate && this.config.PIPELINE_PREFER_G8) {
			return await Context.torrent.queueDownload(episode.files.alternate)
		} else if (episode.files?.extended && extended) {
			return await Context.torrent.queueDownload(episode.files?.extended)
		} else {
			return await Context.torrent.queueDownload(episode.files?.standard)
		}
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

	private async organizeFile(arc: number, episode: number) {
		Context.metadata.checkMetadataDownloaded()
		Logger.debug(
			`S${arc}E${String(episode).padStart(2, '0')} - Verifying path format...`,
		)

		let libraryFile = await Context.library.getExistingLibraryEpisodeFile(
			arc,
			episode,
			true,
		)

		let episodeDescription = await Context.metadata.getEpisode(arc, episode)
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
				`S${arc}E${String(episode).padStart(2, '0')} - File on Media Server with wrong format, renaming...`,
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

			await safeCopyFileSync(serverFile, targetFile)

			await Context.library.scanLibrary(targetLibraryFile.path, arc)

			unlinkSync(serverFile)
			if (trashFiles.length > 0)
				Logger.info(
					`S${arc}E${String(episode).padStart(2, '0')} - Cleaning ${trashFiles.length} trash files...`,
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
			if (!this.config.PIPELINE_SKIP_UPDATE_METADATA_PRESENT_FILES) {
				Logger.debug(
					`S${arc}E${String(episode).padStart(2, '0')} - Correctly formatted...`,
				)
				await this.updatemetadata(arc, episode)
			} else {
				Logger.info(
					`S${arc}E${String(episode).padStart(2, '0')} - Already present`,
				)
			}
		}
	}

	private async process(ma: ArcMetadata, me: EpisodeMetadata) {
		this.report.processedEpisodes++
		Logger.debug(
			`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Processing`,
		)

		const skipVerification =
			this.config.PIPELINE_SKIP_VERIFY_PRESENT_FILES &&
			!(this.config.PIPELINE_SKIP_VERIFY_NOT_FOR_EXTENDED && me.files?.extended)

		// if (me.CRC32.standard == '702231E9') {
		// 	Logger.debug(`Skypiea 14 manual correction`)
		// 	me.CRC32.standard = '704F68EA'
		// }

		// if (ma.arc == 16 && me.episode == 25) {
		// 	if (!this.config.PIPELINE_PREFER_G8) {
		// 		Logger.debug(`Corrected 16. Skypiea 25 for alternate G-8 cut`)
		// 		me.CRC32.standard = 'C951349C'
		// 	}
		// }

		if (this.config.PIPELINE_FORCE_REDOWNLOAD) {
			const queueResult = await this.addToDownloadQueue(
				me,
				!!me.files?.extended && this.config.PIPELINE_PREFER_EXTENDED,
			)
			Logger.info(
				`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Forced re-download from settings [${this.formatDownloadQueueStatus(queueResult)}]`,
			)
			return
		}

		let file = await Context.library.getExistingLibraryEpisodeFile(
			ma.arc,
			me.episode,
		)
		if (file) {
			if (skipVerification) {
				Logger.debug(
					`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Present`,
				)
				if (!this.config.PIPELINE_SKIP_ORGANIZE_PRESENT_FILES) {
					await this.organizeFile(ma.arc, me.episode)
				} else if (!this.config.PIPELINE_SKIP_UPDATE_METADATA_PRESENT_FILES) {
					await this.updatemetadata(ma.arc, me.episode)
				} else {
					Logger.info(
						`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Exist on Media Server (Verification skipped)...`,
					)
				}
			} else {
				Logger.debug(
					`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Exists on Media Server (Verifying)`,
				)

				Logger.debug(
					`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Hashing`,
				)
				let CRC32 = await getFileCrc32Hash(file)
				Logger.debug(
					`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Hash complete (${CRC32})`,
				)

				if (!!me.files?.extended && this.config.PIPELINE_PREFER_EXTENDED) {
					Logger.debug(
						`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Extended wanted`,
					)
					if (
						CRC32 == me.files?.extended?.CRC32 ||
						me.files?.extended?.CRC32_inFileName
					) {
						Logger.debug(
							`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Extended present`,
						)
						if (!this.config.PIPELINE_SKIP_ORGANIZE_PRESENT_FILES) {
							await this.organizeFile(ma.arc, me.episode)
						} else if (
							!this.config.PIPELINE_SKIP_UPDATE_METADATA_PRESENT_FILES
						) {
							await this.updatemetadata(ma.arc, me.episode)
						} else
							Logger.info(
								`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Already present`,
							)
					} else if (
						CRC32 == me.files?.standard?.CRC32 ||
						me.files?.standard?.CRC32_inFileName
					) {
						Logger.debug(
							`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Standard present`,
						)
						if (this.config.PIPELINE_SKIP_DOWNLOADS) {
							Logger.info(
								`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Standard instead of extended [Download skipped]`,
							)
						} else {
							const queueResult = await this.addToDownloadQueue(me, true)
							Logger.info(
								`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Standard instead of extended [${this.formatDownloadQueueStatus(queueResult)}]`,
							)
						}
					}
				} else if (
					!!me.files?.extended &&
					!this.config.PIPELINE_PREFER_EXTENDED
				) {
					Logger.debug(
						`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Standard wanted`,
					)
					if (
						CRC32 == me.files?.standard?.CRC32 ||
						CRC32 == me.files?.standard?.CRC32_inFileName
					) {
						Logger.debug(
							`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Standard present`,
						)
						if (!this.config.PIPELINE_SKIP_ORGANIZE_PRESENT_FILES) {
							await this.organizeFile(ma.arc, me.episode)
						} else if (
							!this.config.PIPELINE_SKIP_UPDATE_METADATA_PRESENT_FILES
						) {
							await this.updatemetadata(ma.arc, me.episode)
						} else
							Logger.info(
								`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Already present`,
							)
					} else if (
						CRC32 == me.files?.extended?.CRC32 ||
						CRC32 == me.files?.extended?.CRC32_inFileName
					) {
						Logger.debug(
							`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Extended present`,
						)
						if (this.config.PIPELINE_SKIP_DOWNLOADS) {
							Logger.info(
								`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Extended instead of Standard [Download skipped]`,
							)
						} else {
							const queueResult = await this.addToDownloadQueue(me)
							Logger.info(
								`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Extended instead of Standard [${this.formatDownloadQueueStatus(queueResult)}]`,
							)
						}
					}
				} else if (
					CRC32 == me.files?.standard?.CRC32 ||
					CRC32 == me.files?.standard?.CRC32_inFileName
				) {
					Logger.debug(
						`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Standard present`,
					)
					if (!this.config.PIPELINE_SKIP_ORGANIZE_PRESENT_FILES) {
						await this.organizeFile(ma.arc, me.episode)
					} else if (!this.config.PIPELINE_SKIP_UPDATE_METADATA_PRESENT_FILES) {
						await this.updatemetadata(ma.arc, me.episode)
					} else
						Logger.info(
							`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Already present`,
						)
				} else if (
					CRC32 == me.files?.extended?.CRC32 ||
					CRC32 == me.files?.extended?.CRC32_inFileName
				) {
					Logger.debug(
						`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Extended present`,
					)
					if (this.config.PIPELINE_SKIP_DOWNLOADS) {
						Logger.info(
							`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Extended instead of Standard [Download skipped]`,
						)
					} else {
						const queueResult = await this.addToDownloadQueue(me)
						Logger.info(
							`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Extended instead of Standard [${this.formatDownloadQueueStatus(queueResult)}]`,
						)
					}
				} else {
					if (this.config.PIPELINE_SKIP_DOWNLOADS) {
						Logger.info(
							`S${ma.arc}E${String(me.episode).padStart(2, '0')} - CRC32 Mismatch [Download skipped]`,
						)
					} else {
						const queueResult = await this.addToDownloadQueue(
							me,
							this.config.PIPELINE_PREFER_EXTENDED && !!me.files?.extended,
						)
						Logger.info(
							`S${ma.arc}E${String(me.episode).padStart(2, '0')} - CRC32 Mismatch [${this.formatDownloadQueueStatus(queueResult)}]`,
						)
					}
				}
			}
		} else {
			Logger.debug(
				`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Missing`,
			)

			if (this.config.PIPELINE_SKIP_DOWNLOADS) {
				Logger.info(
					`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Missing [Download skipped]`,
				)
			} else {
				const queueResult = await this.addToDownloadQueue(
					me,
					this.config.PIPELINE_PREFER_EXTENDED && !!me.files?.extended,
				)
				Logger.info(
					`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Missing [${this.formatDownloadQueueStatus(queueResult)}]`,
				)
			}
		}
	}
}
