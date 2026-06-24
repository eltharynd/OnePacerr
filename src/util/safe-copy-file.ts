import { Logger } from 'ez-ts-logger'
import { existsSync, unlinkSync } from 'node:fs'
import { copyFile } from 'node:fs/promises'

export default function safeCopyFileSync(source: string, destination: string) {
	return new Promise<void>((resolve, reject) => {
		copyFile(source, destination)
			.then(() => {
				resolve()
			})
			.catch(e => {
				Logger.error(`Error Copying '${source}' -> '${destination}'`)
				try {
					if (existsSync(destination)) unlinkSync(destination)
				} catch (ee) {
					Logger.error(`Error deleting '${destination}'`)
					Logger.error(e)
				}
				reject()
			})
	})
}
