import { Utorrent } from '@ctrl/utorrent'
import { Logger } from 'ez-ts-logger'
import environment from '../../environment.js'
import { FileMetadata } from '../../metadata/metadata.model.js'
import {
	ITorrentController,
	Torrent,
	TorrentClient,
	TorrentConnectionError,
} from '../torrent.model.js'

export class UTorrentController implements ITorrentController {
	readonly torrentClient: TorrentClient = 'utorrent'
	private client: Utorrent

	constructor(
		private configs: {
			baseUrl: string
			username: string
			password: string
		},
	) {
		this.client = new Utorrent({
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
			Logger.debug(`MagnetURI already in uTorrent...`)
			if (torrent.category == category || !environment.TORRENT_CATEGORY_FORCE)
				return false
			else {
				Logger.debug(`Forcing category change...`)
				await this.updateTorrentCategory({ hash: torrent.hash }, category)
			}
		} else {
			try {
				let added = await this.client.normalizedAddTorrent(
					this.sanitizeMagnetURI(torrentInfo.magnetURI),
					{ label: category },
				)
				return !!added
			} catch (e) {
				Logger.error(`Failed to add Torrent to uTorrent`)
				throw e
			}
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
						name: t.name,
						category: t.label,
						progress: t.progress / 100,
					}
				}) as T[]
		} catch (e: any) {
			Logger.error(`Could not connect to uTorrent: ${e.message}`)
			Logger.error(e)
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
		let cleared = await this.client.setProps(torrent.hash, {
			s: 'label',
			v: '',
		})
		if (cleared.error) {
			Logger.errorAndThrow(new Error(cleared.error))
		}
		let { build, error } = await this.client.setProps(torrent.hash, {
			s: 'label',
			v: category,
		})
		if (error) {
			Logger.errorAndThrow(new Error(error))
		}
	}

	private sanitizeMagnetURI(magnetUri: string): string {
		const xtMatch = magnetUri.match(/(?:^|[?&])(xt=[^&]+)/)
		const dnMatch = magnetUri.match(/(?:^|[?&])(dn=[^&]+)/)

		if (!xtMatch) {
			throw new Error('Magnet URI has no xt parameter')
		}

		let result = `magnet:?${xtMatch[1]}`
		if (dnMatch) {
			result += `&${dnMatch[1]}`
		}

		return result
	}
}
