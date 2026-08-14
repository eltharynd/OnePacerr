import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { link } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import linkOrCopyFile from './link-or-copy.js'

vi.mock('node:fs/promises', async importOriginal => {
	const actual = await importOriginal<typeof import('node:fs/promises')>()
	return { ...actual, link: vi.fn(actual.link) }
})

describe('Link or copy', () => {
	let dir: string
	let source: string
	let destination: string

	beforeEach(() => {
		dir = mkdtempSync(path.join(tmpdir(), 'onepacerr-link-'))
		source = path.join(dir, 'source.mkv')
		destination = path.join(dir, 'destination.mkv')
		writeFileSync(source, 'payload')
		vi.mocked(link).mockClear()
	})

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true })
	})

	it('Should hardlink when source and destination share a filesystem', async () => {
		await linkOrCopyFile(source, destination)

		expect(statSync(destination).nlink).toBe(2)
		expect(statSync(source).ino).toBe(statSync(destination).ino)
	})

	it('Should replace an existing destination', async () => {
		writeFileSync(destination, 'stale')

		await linkOrCopyFile(source, destination)

		expect(readFileSync(destination, 'utf8')).toBe('payload')
		expect(statSync(destination).nlink).toBe(2)
	})

	let COPY_FALLBACK_CODES = ['EXDEV', 'EPERM', 'ENOSYS', 'ENOTSUP', 'EMLINK']

	it.each(COPY_FALLBACK_CODES)(
		'Should copy when the filesystems differ (%s)',
		async code => {
			vi.mocked(link).mockRejectedValueOnce(
				Object.assign(new Error('link not possible'), { code }),
			)

			await linkOrCopyFile(source, destination)

			expect(readFileSync(destination, 'utf8')).toBe('payload')
			expect(statSync(destination).nlink).toBe(1)
		},
	)

	it('Should rethrow errors that are not a hardlink limitation', async () => {
		vi.mocked(link).mockRejectedValueOnce(
			Object.assign(new Error('no space left on device'), { code: 'ENOSPC' }),
		)

		await expect(linkOrCopyFile(source, destination)).rejects.toThrow()
	})

	it('Should leave an existing destination untouched when linking fails with a non-fallback error', async () => {
		writeFileSync(destination, 'original')
		vi.mocked(link).mockRejectedValueOnce(
			Object.assign(new Error('no space left on device'), { code: 'ENOSPC' }),
		)

		await expect(linkOrCopyFile(source, destination)).rejects.toThrow()

		expect(readFileSync(destination, 'utf8')).toBe('original')
	})

	it('Should not corrupt the destination when two concurrent calls target it', async () => {
		let sourceA = source
		let sourceB = path.join(dir, 'source-b.mkv')
		writeFileSync(sourceB, 'payload-b')

		await Promise.all([
			linkOrCopyFile(sourceA, destination),
			linkOrCopyFile(sourceB, destination),
		])

		let destinationContent = readFileSync(destination, 'utf8')
		let destinationIno = statSync(destination).ino
		expect(statSync(destination).nlink).toBe(2)
		if (destinationContent === 'payload') {
			expect(destinationIno).toBe(statSync(sourceA).ino)
		} else {
			expect(destinationContent).toBe('payload-b')
			expect(destinationIno).toBe(statSync(sourceB).ino)
		}

		let leftoverTempFiles = readdirSync(dir).filter(name =>
			name.includes('.onepacerr-tmp'),
		)
		expect(leftoverTempFiles).toEqual([])
	})
})
