type Diff = { path: string; a: unknown; b: unknown }

export function deepDiff(a: unknown, b: unknown, path = ''): Diff[] {
	if (Object.is(a, b)) return []

	const isObj = (v: unknown): v is Record<string, unknown> =>
		typeof v === 'object' && v !== null

	if (!isObj(a) || !isObj(b)) {
		return [{ path, a, b }]
	}

	const keys = new Set([...Object.keys(a), ...Object.keys(b)])
	const diffs: Diff[] = []

	for (const key of keys) {
		const nextPath = path ? `${path}.${key}` : key
		diffs.push(...deepDiff((a as any)[key], (b as any)[key], nextPath))
	}

	return diffs
}
