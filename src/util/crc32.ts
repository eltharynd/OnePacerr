import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// This will be perfectly typed as a callable function!
const crc32 = require('buffer-crc32')
import fs from 'fs'

/**
 * Calculates the CRC32 hash of a file and returns it as an uppercase hex string.
 * @param filePath System-independent path to the file
 */
export default function getFileCrc32Hash(filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		// 1. Create a readable stream for the file
		const stream = fs.createReadStream(filePath)
		let partialCrc: any = null

		// 2. Update the CRC value incrementally as file chunks stream in
		stream.on('data', (chunk: Buffer | string) => {
			partialCrc = crc32.unsigned(chunk, partialCrc)
		})

		// 3. When the file finishes reading, format the hash output
		stream.on('end', () => {
			if (partialCrc) {
				// Convert the buffer hash to an uppercase hexadecimal string
				//const hexHash = partialCrc.toString('hex').toUpperCase()
				const hexHash = (partialCrc >>> 0).toString(16).toUpperCase()

				// Pad with leading zeros if it's shorter than 8 characters
				resolve(hexHash.padStart(8, '0'))
			} else {
				reject(new Error('File was empty or could not be processed.'))
			}
		})

		// 4. Handle file system errors (e.g., file not found, permission denied)
		stream.on('error', err => reject(err))
	})
}
