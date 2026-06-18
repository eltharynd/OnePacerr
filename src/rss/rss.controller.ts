import Parser from 'rss-parser'
import Logger from '../util/logger.js'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { stat } from 'node:fs/promises'

const RSS_FEED_URL = `https://onepace.net/en/releases/rss.xml`

interface Item {
	'torrent:magnetURI'?: string
	'torrent:infoHash'?: string
	categories?: Array<{
		_: string
		$?: { domain: string }
	}>
	guid: string
	title: string
	link: string
}
interface Feed {
	items: Item[]
}

export class RSSController {
	private readonly parser: Parser<Feed, Item> = new Parser({
		customFields: {
			item: ['torrent:magnetURI', 'torrent:infoHash'],
		},
	})

	private feed: Parser.Output<any>

	constructor() {
		stat('./rss.json')
			.then(data => {
				try {
					this.feed = JSON.parse(readFileSync('./rss.json').toString())
					Logger.info('existing rss.json imported')
				} catch (e) {
					Logger.error('Badly formed rss.json')
				}
			})
			.catch(e => {
				Logger.debug('no rss.json found')
			})
	}

	public async fetch() {
		Logger.debug(`Fetching OnePace RSS Feed`)
		this.feed = await this.parser.parseURL(RSS_FEED_URL)
		writeFileSync(path.resolve('./rss.json'), JSON.stringify(this.feed))
	}

	public async getTorrentInfo(title: string): Promise<{
		magnetURI: string
		infoHash: string
	}> {
		if (!this.feed) await this.fetch()

		let rssTitle = title.replace(
			'The Adventures of the Straw Hats',
			'If You Could Go Anywhere... The Adventures of the Straw Hats',
		)

		if (title === 'Skypiea 20') {
			Logger.debug(`Manual override for Skzpiea 20 (not in RSS feed)`)
			return {
				magnetURI:
					'magnet:?xt=urn:btih:f310ad44380a16a0fef792b5738affccbb0fc65c&dn=%5BOne%20Pace%5D%5B290-291%5D%20Skypiea%2020%20%5B1080p%5D%5B481A9A9D%5D.mkv&tr=http%3A%2F%2Fnyaa.tracker.wf%3A7777%2Fannounce&tr=udp%3A%2F%2Fopen.stealth.si%3A80%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Fexodus.desync.com%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.torrent.eu.org%3A451%2Fannounce',
				infoHash: 'f310ad44380a16a0fef792b5738affccbb0fc65c',
			}
		} else if (title.startsWith('Wano')) {
			let episode = Number.parseInt(title.replace('Wano ', ''))
			if (episode > 4 && episode < 13) {
				Logger.debug(`Manual override for Wano 05-12 (Batch Act 1 Download)`)
				return {
					magnetURI:
						'magnet:?xt=urn:btih:d67ed82392c28cb6c40509383ba70bfb4e6aefdf&dn=%5BOne+Pace%5D%5B909-924%5D+Wano+Act+1&tr=http%3A%2F%2Fnyaa.tracker.wf%3A7777%2Fannounce&tr=udp%3A%2F%2Ftracker.open-internet.nl%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969%2Fannounce&tr=https%3A%2F%2F1.track.ga%3A443%2Fannounce',
					infoHash: 'd67ed82392c28cb6c40509383ba70bfb4e6aefdf',
				}
			}
		}

		Logger.debug(`Searching magnetURI for '${rssTitle}'...`)

		let activeItems = this.feed.items.filter(i => {
			for (let cat of i.categories)
				if (cat._ === 'outdated') {
					return false
				}
			return true
		})

		let item = activeItems.find(i => i.title === rssTitle)
		if (item && item['torrent:magnetURI']) {
			Logger.debug(`Found magnetURI for '${rssTitle}'...`)
			return {
				magnetURI: item['torrent:magnetURI'],
				infoHash: item['torrent:infoHash'],
			}
		} else {
			Logger.debug(
				`Searching magnetURI for '${rssTitle.replace(/\ [0-9]+$/, '')}'...`,
			)
			item = activeItems.find(
				i => i.title === rssTitle.replace(/\ [0-9]+$/, ''),
			)
			if (item && item['torrent:magnetURI']) {
				Logger.debug(
					`Found magnetURI for '${rssTitle.replace(/\ [0-9]+$/, '')}'...`,
				)
				return {
					magnetURI: item['torrent:magnetURI'],
					infoHash: item['torrent:infoHash'],
				}
			} else throw new Error('MagnetURI not found...')
		}
	}
}
