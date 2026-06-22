import { execFileSync } from 'node:child_process'
import { unlinkSync } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import Logger from './logger.js'

export default function safeCopyFileSync(source: string, destination: string) {
	return new Promise<void>((resolve, reject) => {
		copyFile(source, destination)
			.then(() => {
				resolve()
			})
			.catch(e => {
				Logger.error(`Error Copying '${source}}' -> '${destination}'`)
				try {
					if (execFileSync(destination)) unlinkSync(destination)
				} catch (ee) {
					Logger.error(`Error deleting '${destination}'`)
					Logger.error(e)
				}
				reject()
			})
	})
}
