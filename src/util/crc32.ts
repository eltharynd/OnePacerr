import fs from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const crc32 = require('@node-rs/crc32') // native, much faster than buffer-crc32

const SMALL_FILE_THRESHOLD = 16 * 1024 * 1024 // 16MB — tune to your workload
const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB read chunks instead of default 64KB

export default async function getFileCrc32Hash(
	filePath: string,
): Promise<string> {
	const { size } = await fs.promises.stat(filePath)

	// Small files: read once, hash once. Avoids all stream overhead.
	if (size <= SMALL_FILE_THRESHOLD) {
		const buf = await fs.promises.readFile(filePath)
		return (crc32.crc32(buf) >>> 0).toString(16).toUpperCase().padStart(8, '0')
	}

	// Large files: stream with big chunks to minimize event overhead.
	return new Promise((resolve, reject) => {
		const stream = fs.createReadStream(filePath, { highWaterMark: CHUNK_SIZE })
		let crc = 0
		let sawData = false

		stream.on('data', (chunk: Buffer) => {
			sawData = true
			crc = crc32.crc32(chunk, crc)
		})

		stream.on('end', () => {
			if (!sawData && size > 0) {
				reject(new Error('File was empty or could not be processed.'))
				return
			}
			resolve((crc >>> 0).toString(16).toUpperCase().padStart(8, '0'))
		})

		stream.on('error', err => reject(err))
	})
}
