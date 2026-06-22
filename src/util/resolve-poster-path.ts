import { existsSync } from 'fs'
import path from 'path'
import environment from '../environment.js'
import Logger from './logger.js'

export default function resolvePosterPath(options?: IResolvePosterPathOptions) {
	if (
		options != null &&
		(typeof options.arc !== 'number' || Number.isNaN(options.arc))
	) {
		throw new TypeError(
			'resolvePosterPath: when options is provided, options.arc must be a number',
		)
	}

	let targetSet =
		environment.METADATA_POSTER_SET == 'default'
			? 'piratezekk'
			: environment.METADATA_POSTER_SET
	let fallbackSet = 'piratezekk'

	if (!POSTER_SET_VALUES.includes(targetSet)) {
		Logger.error(
			`Invalid METADATA_POSTER_SET specified (${environment.METADATA_POSTER_SET})`,
		)
		throw new TypeError(
			`Invalid METADATA_POSTER_SET specified (${environment.METADATA_POSTER_SET})`,
		)
	}

	let targetPath = `./posters/${targetSet}/${options ? `Season${String(options.arc).padStart(2, '0')}.png` : 'poster.png'}`
	let fallbackPath = `./posters/${fallbackSet}/${options ? `Season${String(options.arc).padStart(2, '0')}.png` : 'poster.png'}`

	let pathOnDisk = path.resolve(targetPath)
	if (existsSync(pathOnDisk)) {
		return pathOnDisk
	} else {
		return path.resolve(fallbackPath)
	}
}

const POSTER_SET_VALUES: readonly string[] = [
	'default',
	'official',
	'piratezekk',
	'mizzoufan523',
]
type IResolvePosterPathOptions = {
	arc: number
}
