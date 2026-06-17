/**
 * Masks a sensitive token by replacing the middle characters with asterisks.
 * * @param token The raw token string to mask.
 * @param visibleStart Number of characters to leave visible at the beginning (default: 4).
 * @param visibleEnd Number of characters to leave visible at the end (default: 4).
 * @returns The masked token string, or the original if too short to mask safely.
 */
export default function mask(
	token: string | null | undefined,
	visibleStart = 4,
	visibleEnd = 4,
): string {
	// 1. Guard against empty, null, or undefined values
	if (!token) {
		return '***'
	}

	const length = token.length
	const totalVisible = visibleStart + visibleEnd

	// 2. If the token is too short to mask cleanly, mask the whole thing
	// to prevent leaking the exact short string.
	if (length <= totalVisible) {
		return '***'
	}

	// 3. Extract the start, end, and build the masked middle segment
	const start = token.slice(0, visibleStart)
	const end = token.slice(-visibleEnd)

	// Creates a dynamic string of '*' matching the exact length of the hidden text
	const maskedMiddle = '*'.repeat(length - totalVisible)

	return `${start}${maskedMiddle}${end}`
}
