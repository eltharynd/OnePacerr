import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { rename } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import moveFile from './move-file.js'

vi.mock('node:fs', async importOriginal => {
	const actual = await importOriginal<typeof import('node:fs')>()
	return { ...actual, unlinkSync: vi.fn(actual.unlinkSync) }
})

vi.mock('node:fs/promises', async importOriginal => {
	const actual = await importOriginal<typeof import('node:fs/promises')>()
	return { ...actual, rename: vi.fn(actual.rename) }
})

describe('Move file', () => {
	let dir: string
	let source: string
	let destination: string

	beforeEach(() => {
		dir = mkdtempSync(path.join(tmpdir(), 'onepacerr-move-'))
		source = path.join(dir, 'source.mkv')
		destination = path.join(dir, 'destination.mkv')
		writeFileSync(source, 'payload')
		vi.mocked(rename).mockClear()
		vi.mocked(unlinkSync).mockClear()
	})

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true })
	})

	it('Should move the file and remove the source', async () => {
		await moveFile(source, destination)

		expect(existsSync(source)).toBe(false)
		expect(readFileSync(destination, 'utf8')).toBe('payload')
	})

	it('Should preserve the inode so existing hardlinks survive', async () => {
		let sibling = path.join(dir, 'sibling.mkv')
		await linkForTest(source, sibling)
		let before = statSync(source).ino

		await moveFile(source, destination)

		expect(statSync(destination).ino).toBe(before)
		expect(statSync(sibling).nlink).toBe(2)
	})

	it('Should copy and unlink when the filesystems differ', async () => {
		vi.mocked(rename).mockRejectedValueOnce(
			Object.assign(new Error('cross-device link'), { code: 'EXDEV' }),
		)

		await moveFile(source, destination)

		expect(existsSync(source)).toBe(false)
		expect(readFileSync(destination, 'utf8')).toBe('payload')
	})

	it('Should rethrow errors that are not a cross-device move', async () => {
		vi.mocked(rename).mockRejectedValueOnce(
			Object.assign(new Error('permission denied'), { code: 'EACCES' }),
		)

		await expect(moveFile(source, destination)).rejects.toThrow()
	})

	it('Should reject when the fallback copy succeeds but removing the source fails', async () => {
		vi.mocked(rename).mockRejectedValueOnce(
			Object.assign(new Error('cross-device link'), { code: 'EXDEV' }),
		)
		vi.mocked(unlinkSync).mockImplementationOnce(() => {
			throw Object.assign(new Error('resource busy'), { code: 'EBUSY' })
		})

		await expect(moveFile(source, destination)).rejects.toThrow()

		expect(readFileSync(destination, 'utf8')).toBe('payload')
	})
})

async function linkForTest(from: string, to: string) {
	let { link } = await vi.importActual<typeof import('node:fs/promises')>(
		'node:fs/promises',
	)
	await link(from, to)
}
