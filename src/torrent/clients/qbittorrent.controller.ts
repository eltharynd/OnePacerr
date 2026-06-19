import {
	QBittorrent,
	Torrent as qbTorrent,
	TorrentCategories,
} from '@ctrl/qbittorrent'
import { TorrentInfo } from '../../metadata/metada.model.js'
import Logger from '../../util/logger.js'
import { ITorrentClient, Torrent, TorrentClient } from '../torrent.model.js'

export class qBittorrentController implements ITorrentClient {
	readonly torrentClient: TorrentClient = 'qbittorrent'
	private client: QBittorrent

	constructor(options: {
		baseUrl: string
		username: string
		password: string
	}) {
		this.client = new QBittorrent(options)
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
			return await this.client.addMagnet(torrentInfo.magnetURI, { category })
		}
	}

	public async getAllTorrents<T = Torrent>(category?: string): Promise<T[]> {
		return (await this.client.listTorrents({ category })) as T[]
	}

	public async getCompletedTorrents<T = Torrent>(
		category?: string,
	): Promise<T[]> {
		return ((await this.getAllTorrents<qbTorrent>()) as qbTorrent[]).filter(
			t => (!category || t.category == category) && t.progress >= 1,
		) as T[]
	}

	public async updateTorrentCategory(
		torrent: Torrent,
		category: string,
	): Promise<void> {
		let categories: TorrentCategories = await this.client.getCategories()
		if (!categories[category]) {
			Logger.debug(`Creating '${category}' qBittorrent category`)
			await this.client.createCategory(category)
		}
		await this.client.setTorrentCategory(torrent.hash, category)
	}
}
