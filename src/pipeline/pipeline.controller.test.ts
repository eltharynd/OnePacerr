import { describe, expect, it, vi } from 'vitest'
import { Context } from '../util/context.js'
import { PipelineController } from './pipeline.controller.js'

vi.mock('../util/crc32.js', () => ({ default: async () => 'AAAA1111' }))

describe('PipelineController.process CRC check', () => {
	it.each([
		['extended', true],
		['standard', true],
		['standard', false],
	])(
		'treats a file as stale when only %s CRC32_inFileName is set and differs (prefer extended %s)',
		async (variant, preferExtended) => {
			const controller = new PipelineController({
				PIPELINE_PREFER_EXTENDED: preferExtended,
				PIPELINE_SKIP_ORGANIZE_PRESENT_FILES: true,
				PIPELINE_SKIP_UPDATE_METADATA_PRESENT_FILES: true,
			} as any) as any
			controller.report = {
				processedEpisodes: 0,
				firstRun: true,
				percentageString: () => '',
			}
			;(Context as any).pipeline = controller
			;(Context as any).metadata = { getEpisode: async () => ({}) }
			;(Context as any).library = {
				getExistingLibraryEpisodeFile: async () => '/library/file.mkv',
			}
			const queue = vi.fn(async () => ({}))
			controller.addToDownloadQueue = queue
			controller.formatDownloadQueueStatus = () => ''

			const files: any = {
				standard: { CRC32: 'BBBB2222' },
				extended: { CRC32: 'CCCC3333' },
			}
			files[variant].CRC32_inFileName = 'DDDD4444'

			await controller.process({ arc: 1 }, { episode: 1, files })

			expect(queue).toHaveBeenCalled()
		},
	)
})
