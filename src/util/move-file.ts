import { Logger } from 'ez-ts-logger'
import { unlinkSync } from 'node:fs'
import { rename } from 'node:fs/promises'
import safeCopyFileSync from './safe-copy-file.js'

export default async function moveFile(source: string, destination: string) {
	try {
		await rename(source, destination)
	} catch (e) {
		let code = (e as NodeJS.ErrnoException)?.code || ''
		if (code != 'EXDEV') {
			Logger.error(`Error Moving '${source}' -> '${destination}'`)
			Logger.error(e)
			throw e
		}
		Logger.warn(
			`Cross-device move (${code}), falling back to copy for '${destination}'`,
		)
		await safeCopyFileSync(source, destination)
		try {
			unlinkSync(source)
		} catch (unlinkError) {
			Logger.error(`Copied to '${destination}'; removal failed`)
			Logger.error(unlinkError)
			throw unlinkError
		}
	}
}
