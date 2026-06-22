import environment from '../environment.js'

export default function resolveSeriesRootFolder(libraryFolder: string): string {
	if (environment.LIBRARY_MEDIA_SERVER === 'none') {
		return libraryFolder
	}

	let folder = libraryFolder
	folder += folder.includes('/') ? '/' : '\\'
	folder += environment.LIBRARY_SERIES_FOLDER_NAME
	return folder
}

export function resolveSeasonFolder(
	libraryFolder: string,
	arc: number,
): string {
	let folder = resolveSeriesRootFolder(libraryFolder)
	folder += folder.includes('/') ? '/' : '\\'
	folder += `Season ${String(arc).padStart(2, '0')}`
	return folder
}
