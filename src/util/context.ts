import Parser from 'rss-parser'
import { Express } from '../api/express.js'
import { RSSController } from '../rss/rss.controller.js'
import { PlexController } from '../plex/plex.controller.js'
import { MetadataController } from '../metadata/metadata.controller.js'
import { QBittorrent, QBittorrentConfig } from '@ctrl/qbittorrent'
import { qBittorrentController } from '../qbittorrent/qbittorrent.controller.js'

class ContextContainer {
	express: Express
	metadata: MetadataController
	rss: RSSController
	plex: PlexController
	torrent: qBittorrentController
}

export const Context = new ContextContainer()

export default {
	express: Express,
	metadata: MetadataController,
	rss: RSSController,
	plex: PlexController,
	torrent: qBittorrentController,
}
