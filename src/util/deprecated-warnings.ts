import { Logger } from 'ez-ts-logger'

export default function deprecatedWarnings() {
	const renamedEnv: { old: string; new: string }[] = [
		{ old: 'PLEX_FILENAME_FORMAT', new: 'LIBRARY_FILENAME_FORMAT' },
		{ old: 'PLEX_SERIES_NAME', new: 'LIBRARY_SERIES_NAME' },
		{ old: 'PLEX_SERIES_FOLDER_NAME', new: 'LIBRARY_FILENAME_FORMAT' },
		{ old: 'MOUNT_LIBRARY_PLEX', new: 'MOUNT_LIBRARY_MEDIA_SERVER' },
		{
			old: 'PLEX_CREATE_SHOW_IF_NOT_FOUND',
			new: 'LIBRARY_CREATE_SHOW_IF_NOT_FOUND',
		},
		{ old: 'MOUNT_DOWNLOADS_QBITTORRENT', new: 'MOUNT_DOWNLOADS_TORRENT' },
		{
			old: 'SKIP_VERIFY_PRESENT_FILES',
			new: 'PIPELINE_SKIP_VERIFY_PRESENT_FILES',
		},
		{
			old: 'SKIP_ORGANIZE_PRESENT_FILES',
			new: 'PIPELINE_SKIP_ORGANIZE_PRESENT_FILES',
		},
		{
			old: 'SKIP_UPDATE_METADATA_PRESENT_FILES',
			new: 'PIPELINE_SKIP_UPDATE_METADATA_PRESENT_FILES',
		},
		{ old: 'SKIP_DOWNLOADS', new: 'PIPELINE_SKIP_DOWNLOADS' },
		{
			old: 'SKIP_DOWNLOADS_IMPORTS',
			new: 'PIPELINE_SKIP_DOWNLOADS_IMPORTS',
		},
		{ old: 'SKIP_POSTERS', new: 'PIPELINE_SKIP_POSTERS' },
		{ old: 'INCLUDE_SPECIALS', new: 'PIPELINE_INCLUDE_SPECIALS' },
		{ old: 'PREFER_EXTENDED', new: 'PIPELINE_PREFER_EXTENDED' },
		{ old: 'PREFER_G8', new: 'PIPELINE_PREFER_ALTERNATE' },
		{ old: 'FILTERS_INCLUDE', new: 'PIPELINE_FILTERS_INCLUDE' },
		{ old: 'FILTERS_EXCLUDE', new: 'PIPELINE_FILTERS_EXCLUDE' },
		{ old: 'DEBUGGING', new: `LOG_LEVEL': 'debug` },
		{ old: 'PIPELINE_PREFER_G8', new: `PIPELINE_PREFER_ALTERNATE` },
	]

	for (let renamed of renamedEnv) {
		if (process.env[renamed.old])
			Logger.warn(
				`ENV_VAR DEPRECATION: You have configured '${renamed.old}'. This has been renamed to '${renamed.new}'. It will continue working temporarily but please update it...`,
			)
	}

	if (process.env['DEBUGGING']) {
		Logger.changeConfigs({ LOG_LEVEL: 'debug' })
	}

	if (
		process.env['METADATA_URL'] ==
		'https://raw.githubusercontent.com/ladyisatis/one-pace-metadata/refs/heads/v2/metadata/data.json'
	) {
		const message = `You're using the old url for metadata. That stopped being supported starting with v1.6.0`

		Logger.critical(message)
		throw new UnsupportedMetadataError(message)
	}

	if (
		process.env['METADATA_URL'] ==
		'https://raw.githubusercontent.com/eltharynd/one-pace-api/refs/heads/main/output/metadata.json'
	) {
		const message = `You're using the old url for metadata. That stopped being supported starting with v1.7.0 in favour of API/WebSocket`

		Logger.critical(message)
		throw new UnsupportedMetadataError(message)
	}
}

export class UnsupportedMetadataError extends Error {
	constructor(message?: string, options?: { cause?: unknown }) {
		super(message, options)
		this.name = 'UnsupportedMetadataError'
	}
}
