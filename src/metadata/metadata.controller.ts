import axios from 'axios'
import { Logger } from 'ez-ts-logger'
import { io, Socket } from 'socket.io-client'
import { js2xml } from 'xml-js'
import environment from '../environment.js'
import { Context } from '../util/context.js'
import { Filter } from '../util/filters.js'
import resolveSeasonPosterFileName from '../util/resolve-season-poster-filename.js'
import resolveSeriesRootFolder from '../util/resolve-series-root-folder.js'
import {
	ArcMetadata,
	CRCNotInMetadata,
	EpisodeMetadata,
	HashNotInMetadata,
	Metadata,
	MetadataAbsentError,
} from './metadata.model.js'

export class MetadataController {
	private metadata: Metadata
	private newMetadata: boolean = false
	private firstRun: boolean = true

	private socket: Socket

	private monitored: ArcMetadata[]

	private TVShowNFO
	private seasonNFOs = {}
	private episodesNFOs = {}

	async refreshMetadata() {
		Logger.info(`Refreshing Metadata...`)

		try {
			let metadata = (await axios.get(`${environment.METADATA_URL}/metadata`))
				.data

			if (!this.metadata || metadata.lastUpdate > this.metadata.lastUpdate) {
				Logger.info(`Newer Metadata found!`)
				this.metadata = metadata
				this.newMetadata = true
			}
		} catch (e) {
			Logger.error(`Error refreshing Metadata, will retry...`)
			Logger.error(e)
		}

		try {
			if (this.newMetadata) await this.sendToPipeline()
			this.newMetadata = false
		} catch (e: any) {
			Logger.error(
				`Unexpected error encountered when sending monitored episodes to pipeline: '${e.message}'`,
			)
			Logger.error(
				`Retry in ${environment.METADATA_CHECK_INTERVAL / 1000} seconds`,
			)
			Logger.error(e)
		} finally {
			if (environment.METADATA_DISABLE_WEBSOCKET) {
				setTimeout(async () => {
					await this.refreshMetadata()
				}, environment.METADATA_CHECK_INTERVAL)
			} else {
				if (!this.socket) {
					Logger.debug(`Connecting WebSocket`)

					this.socket = io('https://onepacerr.com', { timeout: 1000 })

					const timeout = setTimeout(() => {
						if (!this.socket?.connected) {
							Logger.error(`Socket connection could not be estabilished...`)
							Logger.error(`Please check your Stack settings`)
							Logger.error(
								`If your environment doesn't allow for WebSockets, you can always turn METADATA_DISABLE_WEBSOCKET=true`,
							)
							Logger.criticalAndThrow(
								new SocketConnectionError(
									`Socket connection could not be estabilished...`,
								),
							)
						}
					}, 10000)

					this.socket.on('connect', () => {
						Logger.debug(`Connected with id: '${this.socket.id}'`)
						clearTimeout(timeout)

						this.socket.emit('subscribe_to_updates')

						Logger.info(
							`Websocket connected and listening for Metadata updates`,
						)
					})

					this.socket.on('disconnect', () => {
						Logger.debug(`Disconnected from server`)
					})

					this.socket.on('updates', async data => {
						Logger.info(`Metadata updates received! Processing...`)
						this.metadata = (
							await axios.get(`${environment.METADATA_URL}/metadata`)
						).data
						await this.sendToPipeline(true)
					})
				}
			}
		}
	}

	getMonitored(): ArcMetadata[] {
		this.checkMetadataDownloaded()

		return this.monitored
	}

	getTVShowNFO() {
		this.checkMetadataDownloaded()

		return this.TVShowNFO
	}

	getSeasonNFO(arc: number) {
		this.checkMetadataDownloaded()

		return this.seasonNFOs[`${arc}`]
	}

	getEpisodeNFO(arc: number, episode: number) {
		this.checkMetadataDownloaded()

		return this.episodesNFOs[`${arc}`][`${episode}`]
	}

	getEpisode(arc: number, episode: number): EpisodeMetadata {
		this.checkMetadataDownloaded()

		return structuredClone(this.metadata)
			.arcs.find(a => a.arc == arc)
			.episodes.find(e => e.episode == episode)
	}

	getArc(arc: number) {
		this.checkMetadataDownloaded()

		return structuredClone(this.metadata).arcs.find(a => a.arc == arc)
	}

	getShow(): Metadata {
		this.checkMetadataDownloaded()

		return structuredClone(this.metadata)
	}

	findCRC32(arc: number, episode: number): string {
		this.checkMetadataDownloaded()

		const target = this.metadata.arcs
			.find(a => a.arc == arc)
			.episodes.find(e => e.episode == episode)

		if (target.files?.alternate && environment.PIPELINE_PREFER_ALTERNATE) {
			return target.files?.alternate.CRC32
		} else if (target.files?.extended && environment.PIPELINE_PREFER_EXTENDED) {
			return target.files?.extended?.CRC32
		} else return target.files?.standard?.CRC32
	}

	findEpisodeByCRC32(CRC32: string): EpisodeMetadata | undefined {
		this.checkMetadataDownloaded()

		let _found = structuredClone(this.metadata).arcs.find(a => {
			const _found = a.episodes.find(
				e =>
					e.files?.standard?.CRC32 == CRC32 ||
					e.files?.extended?.CRC32 == CRC32 ||
					e.files?.alternate?.CRC32 == CRC32 ||
					!!e.files?.archived?.find(a => a.CRC32 == CRC32),
			)
			if (_found) {
				a.episodes = [_found]
				return true
			}
			return false
		})

		if (!_found) throw new CRCNotInMetadata(`CRC32 ${CRC32} not in metadata...`)
		else return _found.episodes[0]
	}

	findEpisodeByHash(hash: string) {
		this.checkMetadataDownloaded()

		let _found = structuredClone(this.metadata).arcs.find(a => {
			const _found = a.episodes.find(
				e =>
					e.files?.standard?.hash == hash ||
					e.files?.extended?.hash == hash ||
					e.files?.alternate?.hash == hash ||
					!!e.files?.archived?.find(a => a.hash == hash),
			)
			if (_found) {
				a.episodes = [_found]
				return true
			}
			return false
		})

		if (!_found) throw new HashNotInMetadata(`hash ${hash} not in metadata...`)
		else return _found.episodes[0]
	}

	getReport() {
		const base = {
			url: environment.METADATA_URL,
			configs: {
				METADATA_URL: environment.METADATA_URL,
				METADATA_LANGUAGE: environment.METADATA_LANGUAGE,
				METADATA_POSTER_SET: environment.METADATA_POSTER_SET,
				METADATA_CHECK_INTERVAL: environment.METADATA_CHECK_INTERVAL / 1000,
			},
			downloaded: false,
		}
		return base
	}

	private async sendToPipeline(updateNotificationReceived?: boolean) {
		this.checkMetadataDownloaded()

		if (Context.pipeline.isRunning()) await Context.pipeline.waitForFinished()
		Context.pipeline.create()

		Logger.info(`Generating monitored episodes list...`)
		await this.generateMonitored()

		Logger.info(`Generating .nfo files...`)
		await this.generateTVShowNFO()
		await this.generateSeasonNFOs()
		await this.generateEpisodeNFOs()

		Logger.debug(`Adding monitored to pipeline`)
		Context.pipeline.addMonitored(structuredClone(this.monitored))

		Context.pipeline.start(updateNotificationReceived)

		if (this.firstRun && Context.pipeline.isRunning()) {
			this.firstRun = false
			await Context.pipeline.waitForFinished(true)
		}
	}

	private generateMonitored() {
		this.checkMetadataDownloaded()

		this.monitored = structuredClone(this.metadata)
			.arcs.filter(
				a =>
					(a.arc != 0 || environment.PIPELINE_INCLUDE_SPECIALS) &&
					Filter({ arc: a.arc }),
			)
			.map(a => {
				return {
					...a,
					episodes: a.episodes.filter(
						e =>
							(Filter({ arc: a.arc, episode: e.episode }) &&
								e.files?.standard?.hash) ||
							e.files?.extended?.hash ||
							e.files?.alternate?.hash,
					),
				}
			})
	}

	private async generateTVShowNFO() {
		this.checkMetadataDownloaded()

		let namedseason = this.metadata.arcs.map(a => {
			return {
				_attributes: {
					number: a.arc,
				},
				_text: `${a.arc > 0 ? `${a.arc}. ` : ''}${a.title}`,
			}
		})

		let path = resolveSeriesRootFolder(await Context.library.getLibraryFolder())
		path += path.includes('/') ? '/' : '\\'
		path += 'poster.png'

		const title = this.metadata.title.replace(
			'One Pace',
			environment.LIBRARY_SERIES_NAME,
		)

		this.TVShowNFO = `<?xml version='1.0' encoding='utf-8'?>\n${js2xml(
			{
				tvshow: {
					title: title,
					originaltitle: title,
					sorttitle: title,
					outline: this.metadata.description,
					//@ts-ignore
					mpaa: this.metadata.mpaa || this.metadata.customRating,
					customRating: this.metadata.mpaa || this.metadata.customRating,
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

	private async generateSeasonNFOs() {
		this.checkMetadataDownloaded()

		for (let arc of this.metadata.arcs) {
			let path = resolveSeriesRootFolder(
				await Context.library.getLibraryFolder(),
			)
			path += path.includes('/') ? '/' : '\\'
			if (environment.LIBRARY_MEDIA_SERVER === 'none') {
				path += resolveSeasonPosterFileName(arc.arc)
			} else {
				path += `Season ${String(arc.arc).padStart(2, '0')}`
				path += path.includes('/') ? '/' : '\\'
				path += `poster.png`
			}

			const season: any = {
				title: arc.arc == 0 ? arc.title : `${arc.arc}. ${arc.title}`,
				sorttitle: arc.arc,
				seasonnumber: arc.arc,
				plot:
					arc.arc > 0
						? `**[${arc.saga}]**\n\n${arc.description}`
						: arc.description,
				outline: arc.description,
				mpaa: this.metadata.mpaa || this.metadata.customRating,
				customRating: this.metadata.mpaa || this.metadata.customRating,
				lockdata: false,
				art: {
					poster: path,
				},
			}

			if (arc.mangaChapters) {
				season.title = `[${arc.mangaChapters}] ${arc.title}`
				season.originaltitle = `Manga Chapters ${arc.mangaChapters}`
			}
			if (arc.animeEpisodes) {
				season.originaltitle = `${season.originaltitle}, AnimeEpisodes ${arc.animeEpisodes}`
			}

			let NFO = `<?xml version='1.0' encoding='utf-8'?>\n${js2xml(
				{
					season: season,
				},
				{
					compact: true,
					ignoreComment: true,
					spaces: 2,
				},
			)}`

			this.seasonNFOs[`${arc.arc}`] = NFO
		}
	}

	private async generateEpisodeNFOs() {
		this.checkMetadataDownloaded()

		this.episodesNFOs = {}

		for (let arc of this.metadata.arcs) {
			for (let episode of arc.episodes) {
				let episodeDetails: any = {
					title: episode.title,
					//////////////////
					//Implement when Jellyfin updates to allow for multiple versions of an episode
					//Not sure if it's gonna be called displayversion, that's the one for movies
					//displayversion: Standard/Extended/G-8
					////////////////
					originaltitle: episode.title,
					sorttitle: episode.title,

					plot: episode.description,

					showtitle: environment.LIBRARY_SERIES_NAME,

					season: arc.arc,
					displayseason: arc.arc,
					episode: episode.episode,
					displayepisode: episode.episode,

					mpaa: this.metadata.mpaa || this.metadata.customRating,
					customrating: this.metadata.mpaa || this.metadata.customRating,
					lockdata: false,
				}

				if (episode.released)
					episodeDetails.aired = episode.released.split('T')[0]

				const NFO = `<?xml version='1.0' encoding='utf-8'?>\n${js2xml(
					{
						episodedetails: episodeDetails,
					},
					{
						compact: true,
						ignoreComment: true,
						spaces: 2,
					},
				)}`

				if (!this.episodesNFOs[`${arc.arc}`])
					this.episodesNFOs[`${arc.arc}`] = {}
				this.episodesNFOs[`${arc.arc}`][`${episode.episode}`] = NFO
			}
		}
	}

	public checkMetadataDownloaded() {
		if (!this.metadata) {
			Logger.warn(`Metadata missing, something went wrong with import...`)
			throw new MetadataAbsentError()
		}
	}
}

export class SocketConnectionError extends Error {
	constructor(message?: string, options?: { cause?: unknown }) {
		super(message, options)
		this.name = 'SocketConnectionError'
	}
}
