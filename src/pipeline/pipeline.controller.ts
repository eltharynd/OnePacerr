import { EventEmitter } from 'node:events'
import { mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import environment from '../environment.js'
import { TargetLibraryFile } from '../library/library.model'
import { FormattedArc, FormattedEpisode } from '../metadata/metada.model'
import { Context } from '../util/context.js'
import getFileCrc32Hash from '../util/crc32.js'
import Logger from '../util/logger.js'
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

	addMonitored(monitored: FormattedArc[]) {
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

			let formattedFailed: FormattedArc[] = current.monitored.filter(ma =>
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
			}, environment.PIPELINE_RETRY_INTERVAL)
		}

		Logger.info(``)
		if (failed.length > 0) {
			Logger.warn(`##################################`)
			Logger.warn(`#### Pipeline had ${failed.length} failures  ####`)
			Logger.warn(`#### Will retry next cycle    ####`)
			Logger.warn(`##################################`)
		} else {
			Logger.info(`##################################`)
		}
		Logger.info(``)

		await Context.torrent.startWatching()
	}

	private async process(ma: FormattedArc, me: FormattedEpisode) {
		this.report.processedEpisodes++
		Logger.debug(
			`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Processing`,
		)

		if (me.episode == 1) throw new Error()
		const skipVerification =
			environment.SKIP_VERIFY_PRESENT_FILES &&
			!(environment.SKIP_VERIFY_NOT_FOR_EXTENDED && me.CRC32.extended)

		if (me.CRC32.standard == '702231E9') {
			Logger.debug(`Skypiea 14 manual correction`)
			me.CRC32.standard = '704F68EA'
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
				if (!environment.SKIP_ORGANIZE_PRESENT_FILES) {
					await this.organizeFile(ma.arc, me.episode)
				} else if (!environment.SKIP_UPDATE_METADATA_PRESENT_FILES) {
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

				if (ma.arc == 16 && me.episode == 25) {
					if (!environment.PREFER_G8) {
						Logger.debug(`Corrected 16. Skypiea 25 for alternate G-8 cut`)
						me.CRC32.standard = 'C951349C'
					}
				}

				if (!!me.CRC32.extended && environment.PREFER_EXTENDED) {
					Logger.debug(
						`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Extended wanted`,
					)
					if (CRC32 == me.CRC32.extended) {
						Logger.debug(
							`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Extended present`,
						)
						if (!environment.SKIP_ORGANIZE_PRESENT_FILES) {
							await this.organizeFile(ma.arc, me.episode)
						} else if (!environment.SKIP_UPDATE_METADATA_PRESENT_FILES) {
							await this.updatemetadata(ma.arc, me.episode)
						} else
							Logger.info(
								`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Already present`,
							)
					} else if (CRC32 == me.CRC32.standard) {
						Logger.debug(
							`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Standard present`,
						)
						if (environment.SKIP_DOWNLOADS) {
							Logger.info(
								`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Standard instead of extended [Download skipped]`,
							)
						} else {
							const queueResult = await Context.metadata.addToDownloadQueue(
								ma.arc,
								me.episode,
								true,
							)
							Logger.info(
								`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Standard instead of extended [${Context.metadata.formatDownloadQueueStatus(queueResult)}]`,
							)
						}
					}
				} else if (!!me.CRC32.extended && !environment.PREFER_EXTENDED) {
					Logger.debug(
						`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Standard wanted`,
					)
					if (CRC32 == me.CRC32.standard) {
						Logger.debug(
							`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Standard present`,
						)
						if (!environment.SKIP_ORGANIZE_PRESENT_FILES) {
							await this.organizeFile(ma.arc, me.episode)
						} else if (!environment.SKIP_UPDATE_METADATA_PRESENT_FILES) {
							await this.updatemetadata(ma.arc, me.episode)
						} else
							Logger.info(
								`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Already present`,
							)
					} else if (CRC32 == me.CRC32.extended) {
						Logger.debug(
							`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Extended present`,
						)
						if (environment.SKIP_DOWNLOADS) {
							Logger.info(
								`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Extended instead of Standard [Download skipped]`,
							)
						} else {
							const queueResult = await Context.metadata.addToDownloadQueue(
								ma.arc,
								me.episode,
								true,
							)
							Logger.info(
								`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Extended instead of Standard [${Context.metadata.formatDownloadQueueStatus(queueResult)}]`,
							)
						}
					}
				} else {
					console.log(6)
					if (environment.SKIP_DOWNLOADS) {
						Logger.info(
							`S${ma.arc}E${String(me.episode).padStart(2, '0')} - CRC32 Mismatch [Download skipped]`,
						)
					} else {
						const queueResult = await Context.metadata.addToDownloadQueue(
							ma.arc,
							me.episode,
							environment.PREFER_EXTENDED && !!me.CRC32.extended,
						)
						Logger.info(
							`S${ma.arc}E${String(me.episode).padStart(2, '0')} - CRC32 Mismatch [${Context.metadata.formatDownloadQueueStatus(queueResult)}]`,
						)
					}
				}
			}
		} else {
			Logger.debug(
				`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Missing`,
			)

			if (environment.SKIP_DOWNLOADS) {
				Logger.info(
					`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Missing [Download skipped]`,
				)
			} else {
				const queueResult = await Context.metadata.addToDownloadQueue(
					ma.arc,
					me.episode,
					environment.PREFER_EXTENDED && !!me.CRC32.extended,
				)
				Logger.info(
					`S${ma.arc}E${String(me.episode).padStart(2, '0')} - Missing [${Context.metadata.formatDownloadQueueStatus(queueResult)}]`,
				)
			}
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
			Logger.debug(
				`S${arc}E${String(episode).padStart(2, '0')} - Correctly formatted...`,
			)
			if (!environment.SKIP_UPDATE_METADATA_PRESENT_FILES) {
				await this.updatemetadata(arc, episode)
			}
		}
	}

	async updatemetadata(arc: number, episode: number) {
		Context.metadata.checkMetadataDownloaded()
		Logger.debug(
			`S${arc}E${String(episode).padStart(2, '0')} - Attempting Metadata Update`,
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
		Logger.info(
			`S${arc}E${String(episode).padStart(2, '0')} - Exists on Media Server (Metadata refreshed)`,
		)
	}

	getReport() {
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
}
