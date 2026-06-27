import axios from 'axios'
import { Logger } from 'ez-ts-logger'
import { io } from 'socket.io-client'
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
	Metadata,
	MetadataAbsentError,
} from './metadata.model.js'

export class MetadataController {
	private metadata: Metadata
	private newMetadata: boolean = false

	private socket

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
		} finally {
			if (environment.METADATA_DISABLE_WEBSOCKET) {
				setTimeout(async () => {
					await this.refreshMetadata()
				}, environment.METADATA_CHECK_INTERVAL)
			} else {
				if (!this.socket) {
					Logger.debug(`Connecting WebSocket`)
					this.socket = io('https://onepacerr.com')

					this.socket.on('connect', () => {
						Logger.debug(`Connected with id: '${this.socket.id}'`)
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
						await this.sendToPipeline()
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

		return this.metadata.arcs
			.find(a => a.arc == arc)
			.episodes.find(e => e.episode == episode)
	}

	getArc(arc: number) {
		this.checkMetadataDownloaded()

		return this.metadata.arcs.find(a => a.arc)
	}

	getShow(): Metadata {
		this.checkMetadataDownloaded()

		return this.metadata
	}

	findCRC32(arc: number, episode: number): string {
		this.checkMetadataDownloaded()

		const target = this.metadata.arcs
			.find(a => a.arc == arc)
			.episodes.find(e => e.episode == episode)

		if (target.files.alternate && environment.PIPELINE_PREFER_G8) {
			return target.files.alternate.CRC32
		} else if (target.files?.extended && environment.PIPELINE_PREFER_EXTENDED) {
			return target.files?.extended?.CRC32
		} else return target.files?.standard?.CRC32
	}

	findEpisodeByCRC32(CRC32: string): EpisodeMetadata | undefined {
		this.checkMetadataDownloaded()

		let episode: EpisodeMetadata

		let _found = this.metadata.arcs.find(a => {
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

	private async sendToPipeline() {
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
		Context.pipeline.addMonitored(this.monitored)

		Context.pipeline.start()
	}

	private generateMonitored() {
		this.checkMetadataDownloaded()

		this.monitored = this.metadata.arcs
			.filter(
				a =>
					(a.arc != 0 || environment.PIPELINE_INCLUDE_SPECIALS) &&
					Filter({ arc: a.arc }),
			)
			.map(a => {
				return {
					...a,
					episodes: a.episodes.filter(
						e => !!e.released && Filter({ arc: a.arc, episode: e.episode }),
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
					customrating: this.metadata.customRating,
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

			let NFO = `<?xml version='1.0' encoding='utf-8'?>\n${js2xml(
				{
					season: {
						title: arc.arc == 0 ? arc.title : `${arc.arc}. ${arc.title}`,
						sorttitle: arc.arc == 0 ? arc.title : `${arc.arc}. ${arc.title}`,
						seasonnumber: arc.arc,
						plot: arc.description,
						outline: arc.description,
						overview: arc.description,
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

			this.seasonNFOs[`${arc.arc}`] = NFO
		}
	}

	private async generateEpisodeNFOs() {
		this.checkMetadataDownloaded()

		this.episodesNFOs = {}
		for (let arc of this.metadata.arcs) {
			for (let episode of arc.episodes) {
				let NFO = `<?xml version='1.0' encoding='utf-8'?>\n${js2xml(
					{
						episodedetails: {
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

							customrating: this.metadata.customRating,
							lockdata: false,
						},
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
