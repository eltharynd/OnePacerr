import axios from 'axios'
import { js2xml } from 'xml-js'
import environment from '../environment.js'
import { Context } from '../util/context.js'
import { Filter } from '../util/filters.js'
import Logger from '../util/logger.js'
import resolveSeasonPosterFileName from '../util/resolve-season-poster-filename.js'
import resolveSeriesRootFolder from '../util/resolve-series-root-folder.js'
import {
	CRCNotInMetadata,
	Episode,
	EpisodeDescription,
	FormattedArc,
	MetadataAbsentError,
	RawMetadataJson,
} from './metada.model.js'

export class MetadataController {
	private metadata: RawMetadataJson
	private newMetadata: boolean = false

	private monitored: FormattedArc[]

	private TVShowNFO
	private seasonNFOs = {}
	private episodesNFOs = {}

	async refreshMetadata() {
		Logger.info(`Refreshing Metadata...`)

		try {
			let metadata = (await axios.get(environment.METADATA_URL)).data
			if (
				!this.metadata ||
				metadata.status.last_update > this.metadata.status.last_update
			) {
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
			setTimeout(async () => {
				await this.refreshMetadata()
			}, environment.METADATA_CHECK_INTERVAL)
		}
	}

	getMonitored(): FormattedArc[] {
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

	findCRC32(arc: number, episode: number): string {
		this.checkMetadataDownloaded()

		let target = this.metadata.arcs[environment.METADATA_LANGUAGE]
			.find(a => a.part === arc)
			.episodes.find(e => Number.parseInt(e.episode) == episode)
		return environment.PIPELINE_PREFER_EXTENDED && !!target.extended
			? target.extended
			: target.standard
	}

	findEpisode(CRC32: string): Episode {
		this.checkMetadataDownloaded()

		let episode = this.metadata.episodes[CRC32]
		if (!episode) {
			if (CRC32 == '704F68EA') {
				Logger.debug(`Skypiea 14 manual correction`)
				return { arc: 16, episode: 14 }
			}
			Logger.debug(
				`CRC32 ${CRC32} not in metadata... Probably just an out of date release included in a batch...`,
			)
			throw new CRCNotInMetadata(`CRC32 ${CRC32} not in metadata...`)
		}
		return episode
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

		if (!this.metadata) return base

		return {
			...base,
			downloaded: true,
			age: new Date(this.metadata?.status.last_update),

			arcs: {
				monitored: this.metadata.arcs[environment.METADATA_LANGUAGE].filter(
					a =>
						(a.part != 0 || environment.PIPELINE_INCLUDE_SPECIALS) &&
						Filter({ arc: a.part }),
				).length,
				total: Object.keys(this.metadata.arcs[environment.METADATA_LANGUAGE])
					.length,
			},
			episodes: {
				monitored: this.metadata.arcs[environment.METADATA_LANGUAGE]
					.filter(
						a =>
							(a.part != 0 || environment.PIPELINE_INCLUDE_SPECIALS) &&
							Filter({ arc: a.part }),
					)
					.map(a => {
						return a.episodes.filter(e =>
							Filter({ arc: a.part, episode: e.episode }),
						).length
					})
					.reduce((acc, curr) => acc + curr),
				total: Object.keys(this.metadata.episodes).length,
			},
		}
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
		this.monitored = this.metadata.arcs[environment.METADATA_LANGUAGE]
			.filter(
				a =>
					(a.part != 0 || environment.PIPELINE_INCLUDE_SPECIALS) &&
					Filter({ arc: a.part }),
			)
			.map(a => {
				return {
					arc: a.part,
					title: a.title,
					description: a.description,
					episodes: a.episodes
						.filter(e => Filter({ arc: a.part, episode: e.episode }))
						.map(e => {
							const desc = this.getEpisodeDescription(
								a.part,
								Number.parseInt(e.episode),
							)
							return {
								episode: Number.parseInt(e.episode),
								title: desc?.title,
								description: desc?.description,
								CRC32: {
									standard: e.standard,
									extended: e.extended,
								},
							}
						}),
				}
			})
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

		let path = resolveSeriesRootFolder(await Context.library.getLibraryFolder())
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

	private async generateSeasonNFOs() {
		this.checkMetadataDownloaded()

		let arcs = JSON.parse(
			JSON.stringify(this.metadata.arcs[environment.METADATA_LANGUAGE]),
		)

		for (let a of arcs) {
			let path = resolveSeriesRootFolder(
				await Context.library.getLibraryFolder(),
			)
			path += path.includes('/') ? '/' : '\\'
			if (environment.LIBRARY_MEDIA_SERVER === 'none') {
				path += resolveSeasonPosterFileName(a.part)
			} else {
				path += `Season ${String(a.part).padStart(2, '0')}`
				path += path.includes('/') ? '/' : '\\'
				path += `poster.png`
			}

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

	public checkMetadataDownloaded() {
		if (!this.metadata) {
			Logger.warn(`Metadata missing, something went wrong with import...`)
			throw new MetadataAbsentError()
		}
	}
}
