import { Deluge } from '@ctrl/deluge'
import { TorrentInfo } from '../../metadata/metada.model.js'
import Logger from '../../util/logger.js'
import {
	ITorrentController,
	Torrent,
	TorrentClient,
	TorrentConnectionError,
} from '../torrent.model.js'

export class DelugeController implements ITorrentController {
	readonly torrentClient: TorrentClient = 'deluge'
	private client: Deluge

	constructor(options: {
		baseUrl: string
		username: string
		password: string
	}) {
		this.client = new Deluge(options)
	}

	public async addTorrent(
		torrentInfo: TorrentInfo,
		category: string,
	): Promise<boolean> {
		let torrents = await this.getAllTorrents()
		if (torrents.find(t => t.hash === torrentInfo.infoHash)) {
			Logger.debug(`MagnetURI already in qBittorrent...`)
			return false
		} else {
			let torrent: Partial<Torrent> = {
				hash: torrentInfo.infoHash,
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
						content_path: t.savePath,
						category: t.label,
						progress: t.isCompleted ? 1 : t.progress / 100,
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

export class LabelsDisabledInDelugeError extends Error {}
