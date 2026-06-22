export default function resolveSeasonPosterFileName(arc: number): string {
	return `season${String(arc).padStart(2, '0')}-poster.png`
}
