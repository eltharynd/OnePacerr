import { Logger } from 'ez-ts-logger'
import { randomUUID } from 'node:crypto'
import { existsSync, unlinkSync } from 'node:fs'
import { link, rename } from 'node:fs/promises'
import safeCopyFileSync from './safe-copy-file.js'

/** errno codes meaning 'this filesystem cannot hardlink', not 'this failed' */
const COPY_FALLBACK_CODES = ['EXDEV', 'EPERM', 'ENOSYS', 'ENOTSUP', 'EMLINK']

export default async function linkOrCopyFile(
	source: string,
	destination: string,
) {
	let temp = `${destination}.onepacerr-tmp-${randomUUID()}`
	try {
		await link(source, temp)
	} catch (e) {
		let code = (e as NodeJS.ErrnoException)?.code || ''
		if (!COPY_FALLBACK_CODES.includes(code)) {
			Logger.error(`Error Linking '${source}' -> '${destination}'`)
			Logger.error(e)
			throw e
		}
		Logger.warn(
			`Hardlink not possible (${code}), falling back to copy for '${destination}'`,
		)
		await safeCopyFileSync(source, destination)
		return
	}
	try {
		await rename(temp, destination)
	} catch (e) {
		Logger.error(`Error Renaming '${temp}' -> '${destination}'`)
		Logger.error(e)
		try {
			if (existsSync(temp)) unlinkSync(temp)
		} catch (cleanupError) {
			Logger.error(`Error deleting '${temp}'`)
			Logger.error(cleanupError)
		}
		throw e
	}
}
