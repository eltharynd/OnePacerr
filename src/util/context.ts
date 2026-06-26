import { Express } from '../api/express.js'
import { LibraryController } from '../library/library.controller.js'
import { MetadataController } from '../metadata/metadata.controller.js'
import { PipelineController } from '../pipeline/pipeline.controller.js'
import { TorrentController } from '../torrent/torrent.controller.js'

class ContextContainer {
	express: Express
	library: LibraryController
	metadata: MetadataController
	pipeline: PipelineController
	torrent: TorrentController
}

export const Context = new ContextContainer()
