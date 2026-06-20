export default function sanitizeWindowsFileName(fileName: string): string {
	return fileName
		.replace(/"/g, '“') // Replace straight double quotes with curly ones
		.replace(/:/g, ' -') // Replace colons with a dash (common for subtitles/arcs)
		.replace(/[*?<>|]/g, '') // Remove other illegal characters completely
}
