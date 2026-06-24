import {
	QBittorrent,
	Torrent as qbTorrent,
	TorrentCategories,
} from '@ctrl/qbittorrent'
import environment from '../../environment.js'
import { TorrentInfo } from '../../metadata/metadata.model.js'
import Logger from '../../util/logger.js'
import {
	ITorrentController,
	Torrent,
	TorrentClient,
	TorrentConnectionError,
} from '../torrent.model.js'

export class qBittorrentController implements ITorrentController {
	readonly torrentClient: TorrentClient = 'qbittorrent'
	private client: QBittorrent

	constructor(options: {
		baseUrl: string
		username: string
		password: string
	}) {
		this.client = new QBittorrent({
			...options,
			timeout: environment.TORRENT_CLIENT_TIMEOUT,
		})
	}

	public async addTorrent(
		torrentInfo: TorrentInfo,
		category: string,
	): Promise<boolean> {
		let torrent = (await this.getAllTorrents()).find(
			t => t.hash === torrentInfo.infoHash,
		)
		if (torrent) {
			Logger.debug(`MagnetURI already in qBittorrent...`)
			if (torrent.category == category || !environment.TORRENT_CATEGORY_FORCE)
				return false
			else {
				Logger.debug(`Forcing category change...`)
				await this.updateTorrentCategory({ hash: torrent.hash }, category)
			}
		} else {
			return await this.client.addMagnet(torrentInfo.magnetURI, { category })
		}
	}

	public async getAllTorrents<T = Torrent>(category?: string): Promise<T[]> {
		try {
			return (await this.client.listTorrents({ category })) as T[]
		} catch (e: any) {
			Logger.error(`Could not connect to qBittorrent: ${e.message}`)
			throw new TorrentConnectionError()
		}
	}

	public async getCompletedTorrents<T = Torrent>(
		category?: string,
	): Promise<T[]> {
		return ((await this.getAllTorrents<qbTorrent>()) as qbTorrent[]).filter(
			t => (!category || t.category == category) && t.progress >= 1,
		) as T[]
	}

	public async updateTorrentCategory(
		torrent: Partial<Torrent>,
		category: string,
	): Promise<void> {
		try {
			await this.client.setTorrentCategory(torrent.hash, category)
		} catch (e) {
			let categories: TorrentCategories = await this.client.getCategories()

			if (!categories[category]) {
				Logger.debug(`Creating '${category}' qBittorrent category`)
				await this.client.createCategory(category)
			}
			await this.client.setTorrentCategory(torrent.hash, category)
		}
	}
}
