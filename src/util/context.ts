import { Express } from '../api/express.js'
import { MetadataController } from '../metadata/metadata.controller.js'
import { LibraryController } from '../library/library.controller.js'
import { RSSController } from '../rss/rss.controller.js'
import { TorrentController } from '../torrent/torrent.controller.js'

class ContextContainer {
	express: Express
	metadata: MetadataController
	rss: RSSController
	library: LibraryController
	torrent: TorrentController
}

export const Context = new ContextContainer()

export default {
	express: Express,
	metadata: MetadataController,
	rss: RSSController,
	library: LibraryController,
	torrent: TorrentController,
}
