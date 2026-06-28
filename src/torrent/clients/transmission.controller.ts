import { Transmission } from '@ctrl/transmission'
import { Logger } from 'ez-ts-logger'
import environment from '../../environment.js'
import { FileMetadata } from '../../metadata/metadata.model.js'
import {
	ITorrentController,
	Torrent,
	TorrentClient,
	TorrentConnectionError,
} from '../torrent.model.js'

export class TransmissionController implements ITorrentController {
	readonly torrentClient: TorrentClient = 'transmission'
	private client: Transmission

	constructor(
		private configs: {
			baseUrl: string
			username: string
			password: string
		},
	) {
		this.client = new Transmission({
			...configs,
			timeout: environment.TORRENT_CLIENT_TIMEOUT,
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
			Logger.debug(`MagnetURI already in Trasmission...`)
			if (torrent.category == category || !environment.TORRENT_CATEGORY_FORCE)
				return false
			else {
				Logger.debug(`Forcing category change...`)
				await this.updateTorrentCategory({ hash: torrent.hash }, category)
			}
		} else {
			const downloadDir = (await this.client.getSession()).arguments[
				'download-dir'
			]
			let added = await this.client.addMagnet(torrentInfo.magnetURI, {
				'download-dir': downloadDir,
			})
			if (added) {
				await this.updateTorrentCategory({ hash: torrent.hash }, category)
			}
			return !!added
		}
	}

	public async getAllTorrents<T = Torrent>(category?: string): Promise<T[]> {
		try {
			return (await this.client.getAllData()).torrents
				.filter(
					t =>
						!environment.TORRENT_CATEGORY_FORCE ||
						!category ||
						t.label == category,
				)
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
			Logger.error(`Could not connect to Transmission: ${e.message}`)
			if (e instanceof Error) throw e
			else throw new TorrentConnectionError()
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
			await this.client.setTorrent(torrent.hash, { labels: [category] })
		} catch (e) {
			Logger.error(`Error updating torrent categories`)
			Logger.errorAndThrow(e)
		}
	}
}
