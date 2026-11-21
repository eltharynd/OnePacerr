import { describe, expect, it } from 'vitest'
import { qBittorrentController } from './qbittorrent.controller.js'

const configOf = (controller: qBittorrentController) =>
	(controller as any).client.config as { apiKey?: string; username?: string }

describe('qBittorrent authentication', () => {
	it('passes an API key through to the client', () => {
		const controller = new qBittorrentController({
			baseUrl: 'http://localhost:8080',
			username: 'user',
			password: 'password',
			apiKey: 'key',
		})
		expect(configOf(controller).apiKey).toBe('key')
	})

	it('uses the username and password when no API key is set', () => {
		const controller = new qBittorrentController({
			baseUrl: 'http://localhost:8080',
			username: 'user',
			password: 'password',
		})
		expect(configOf(controller).apiKey).toBeUndefined()
		expect(configOf(controller).username).toBe('user')
	})
})
