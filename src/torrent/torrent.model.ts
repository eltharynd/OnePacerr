import { TorrentInfo } from '../metadata/metada.model.js'

export type TorrentClient = 'qbittorrent' | 'utorrent' | 'deluge'
export type Torrent = {
	readonly hash: string
	readonly content_path: string
}

export interface ITorrentClient {
	readonly torrentClient: TorrentClient

	addTorrent(torrentInfo: TorrentInfo, category: string): Promise<boolean>
	getAllTorrents(category?: string): Promise<Torrent[]>
	getCompletedTorrents(category?: string): Promise<Torrent[]>
	updateTorrentCategory(torrent: Torrent, category: string): Promise<void>
}
