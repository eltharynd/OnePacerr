import { FileMetadata } from '../metadata/metadata.model'

export type TorrentClient = 'qbittorrent' | 'utorrent' | 'deluge'
export type QueueDownloadResult = 'added' | 'already_present' | 'skipped'
export type Torrent = {
	readonly hash: string
	readonly content_path: string
	readonly save_path?: string
	readonly name?: string
	readonly category?: string
	readonly progress?: number
}

export interface ITorrentController {
	readonly torrentClient: TorrentClient

	addTorrent(torrentInfo: FileMetadata, category: string): Promise<boolean>
	getAllTorrents(category?: string): Promise<Torrent[]>
	getCompletedTorrents(category?: string): Promise<Torrent[]>
	updateTorrentCategory(torrent: Torrent, category: string): Promise<void>
}

export class TorrentConnectionError extends Error {
	constructor(message?: string, options?: { cause?: unknown }) {
		super(message, options)
		this.name = 'TorrentConnectionError'
	}
}
