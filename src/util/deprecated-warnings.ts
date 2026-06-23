import Logger from './logger.js'

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
		{ old: 'PREFER_G8', new: 'PIPELINE_PREFER_G8' },
		{ old: 'FILTERS_INCLUDE', new: 'PIPELINE_FILTERS_INCLUDE' },
		{ old: 'FILTERS_EXCLUDE', new: 'PIPELINE_FILTERS_EXCLUDE' },
	]

	for (let renamed of renamedEnv) {
		if (process.env[renamed.old])
			Logger.warn(
				`ENV_VAR DEPRECATION: You have configured '${renamed.old}'. This has been renamed to '${renamed.new}'. It will continue working temporarily but please update it...`,
			)
	}
}
