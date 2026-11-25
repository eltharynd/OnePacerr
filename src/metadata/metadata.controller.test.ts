import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '../util/context.js'
import { MetadataController } from './metadata.controller.js'

const handlers: Record<string, (...args: any[]) => any> = {}

vi.mock('socket.io-client', () => ({
	io: () => ({
		id: 'test',
		connected: true,
		on: (event: string, fn: (...args: any[]) => any) => (handlers[event] = fn),
		emit: () => {},
	}),
}))
vi.mock('axios', () => ({ default: { get: vi.fn() } }))

const metadata = (lastUpdate: string) => ({ lastUpdate, arcs: [] })

// Fake pipeline that, like the real one, refuses new work while running.
const fakePipeline = () => {
	let running = false
	let finish: () => void = () => {}
	return {
		runs: 0,
		isRunning: () => running,
		waitForFinished: () => new Promise<void>(r => (finish = r)),
		create: () => {},
		addMonitored: () => {
			if (running) throw new Error('Pipeline not done')
		},
		start() {
			running = true
			this.runs++
		},
		finish() {
			running = false
			finish()
		},
	}
}

describe('MetadataController', () => {
	let controller: MetadataController
	let pipeline: ReturnType<typeof fakePipeline>
	const get = axios.get as unknown as ReturnType<typeof vi.fn>

	beforeEach(() => {
		pipeline = fakePipeline()
		;(Context as any).pipeline = pipeline
		controller = new MetadataController()
		const c = controller as any
		for (const m of [
			'generateMonitored',
			'generateTVShowNFO',
			'generateSeasonNFOs',
			'generateEpisodeNFOs',
		])
			c[m] = vi.fn()
		c.firstRun = false
		c.compareChanges = (m: any) => m
	})

	afterEach(() => {
		vi.clearAllMocks()
		for (const k of Object.keys(handlers)) delete handlers[k]
	})

	it('re-fetches metadata on reconnect so missed updates are processed', async () => {
		get.mockResolvedValue({ data: metadata('1') })
		await controller.refreshMetadata()
		expect(pipeline.runs).toBe(1)
		pipeline.finish()

		handlers.connect() // initial connect: no re-fetch
		expect(get).toHaveBeenCalledTimes(1)

		// update '2' pushed while disconnected, then reconnect
		get.mockResolvedValue({ data: metadata('2') })
		handlers.connect()
		await vi.waitFor(() => expect(pipeline.runs).toBe(2))
	})

	it('queues a socket update that arrives while a pipeline is running', async () => {
		get.mockResolvedValue({ data: metadata('1') })
		await controller.refreshMetadata()
		expect(pipeline.runs).toBe(1)

		// two updates land mid-run; neither may throw, both must run in turn
		const a = handlers.updates(metadata('2'))
		const b = handlers.updates(metadata('3'))
		await Promise.resolve()
		pipeline.finish()
		await vi.waitFor(() => expect(pipeline.runs).toBe(2))
		pipeline.finish()
		await expect(Promise.all([a, b])).resolves.toBeDefined()
		expect(pipeline.runs).toBe(3)
	})
})
