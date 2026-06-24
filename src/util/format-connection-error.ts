import { Logger } from 'ez-ts-logger'

export function formatConnectionError(
	label: string,
	url: string,
	error: unknown,
): string {
	const parts = [`${label}: could not reach ${url}`]

	if (error instanceof Error) {
		const cause = error.cause
		if (cause instanceof Error) {
			parts.push(`cause: ${cause.message}`)
			const code = (cause as NodeJS.ErrnoException).code
			if (code) parts.push(`code: ${code}`)
		} else if (error.message && error.message !== 'fetch failed') {
			parts.push(error.message)
		}
	}

	if (/localhost|127\.0\.0\.1/.test(url)) {
		parts.push(
			'hint: localhost is the OnePacerr container — use the Emby service hostname instead',
		)
	}

	return parts.join(' — ')
}

export function logErrorCause(error: unknown) {
	if (!(error instanceof Error) || !error.cause) return

	if (error.cause instanceof Error) {
		Logger.error(`Caused by: ${error.cause.message}`)
		const code = (error.cause as NodeJS.ErrnoException).code
		if (code) Logger.error(`Error code: ${code}`)
	} else {
		Logger.error(`Caused by: ${error.cause}`)
	}
}
