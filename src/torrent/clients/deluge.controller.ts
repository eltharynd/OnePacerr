import { Deluge } from '@ctrl/deluge'
import { Logger } from 'ez-ts-logger'
import environment from '../../environment.js'
import { FileMetadata } from '../../metadata/metadata.model.js'
import {
	ITorrentController,
	Torrent,
	TorrentClient,
	TorrentConnectionError,
} from '../torrent.model.js'

export class DelugeController implements ITorrentController {
	readonly torrentClient: TorrentClient = 'deluge'
	private client: Deluge

	constructor(
		private configs: {
			baseUrl: string
			username: string
			password: string
		},
	) {
		this.client = new Deluge({
			...configs,
			timeout: environment.TORRENT_CLIENT_TIMEOUT,
		})

		this.client
			.getPlugins()
			.then(({ result, error }) => {
				if (error) throw error
				if (!result.enabled_plugins.find(p => p == 'Label'))
					throw new LabelsDisabledInDelugeError(
						`Deluge Label plugin is required for operations, but deluge reports it disabled`,
					)
			})
			.catch(e => {
				Logger.errorAndThrow(e)
			})
	}

	public async addTorrent(
		torrentInfo: FileMetadata,
		category: string,
	): Promise<boolean> {
		let torrent = (await this.getAllTorrents()).find(
			t => t.hash === torrentInfo.hash,
		)
		if (torrent) {
			Logger.debug(`MagnetURI already in Deluge...`)
			if (torrent.category == category || !environment.TORRENT_CATEGORY_FORCE)
				return false
			else {
				Logger.debug(`Forcing category change...`)
				await this.updateTorrentCategory({ hash: torrent.hash }, category)
			}
		} else {
			let torrent: Partial<Torrent> = {
				hash: torrentInfo.hash,
			}
			let added = (await this.client.addTorrentMagnet(torrentInfo.magnetURI))
				.result
			if (added) {
				await this.updateTorrentCategory(torrent, category)
			}
			return !!added
		}
	}

	public async getAllTorrents<T = Torrent>(category?: string): Promise<T[]> {
		try {
			return (await this.client.getAllData()).torrents
				.filter(t => !category || t.label == category)
				.map(t => {
					return {
						hash: t.id,
						content_path: `${t.savePath}${t.savePath.includes('/') ? '/' : '\\'}${t.name}`,
						name: t.name,
						category: t.label,
						progress: t.progress,
					}
				}) as T[]
		} catch (e: any) {
			Logger.error(`Could not connect to Deluge: ${e.message}`)
			throw new TorrentConnectionError()
		}
	}

	public async getCompletedTorrents<T = Torrent>(
		category?: string,
	): Promise<T[]> {
		return (await this.getAllTorrents<Torrent>()).filter(
			t => (!category || t.category == category) && t.progress >= 1,
		) as T[]
	}

	public async updateTorrentCategory(
		torrent: Partial<Torrent>,
		category: string,
	): Promise<void> {
		try {
			let { result, error } = await this.client.setTorrentLabel(
				torrent.hash,
				category,
			)
			if (error) throw new Error('Deluge Category missing')
		} catch (e) {
			let categories: string[] = (await this.client.getLabels()).result
			if (!categories || !categories[category]) {
				Logger.debug(`Creating '${category}' Deluge category`)
				let { result, error }: any = await this.client.addLabel(category)
				if (error?.message == 'Unknown method') {
					Logger.error(
						`Labels need to be enabled in Deluge (Preferences -> Plugins -> Label)`,
					)
					throw new LabelsDisabledInDelugeError()
				}
				if (error) throw new Error(error)
			}

			let { result, error } = await this.client.setTorrentLabel(
				torrent.hash,
				category,
			)
			if (error) throw new Error(error)
		}
	}
}

export class LabelsDisabledInDelugeError extends Error {
	constructor(message?: string, options?: { cause?: unknown }) {
		super(message, options)
		this.name = 'LabelsDisabledInDelugeError'
	}
}
