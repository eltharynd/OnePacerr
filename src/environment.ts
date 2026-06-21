import dotenv from 'dotenv'
dotenv.config({ path: './.env' })

export default {
	/**
	 * GENERAL
	 */
	LOG_OUTPUT: process.env.LOG_OUTPUT || 'text',
	DEBUGGING: /true/i.test(process.env.DEBUGGING || 'false'),

	TESTING:
		/test/i.test(process.env.NODE_ENV) || /true/i.test(process.env.TESTING),

	DOMAIN: process.env.DOMAIN || 'localhost',
	API_BASE: process.env.API_BASE || '/api/v1/',
	PORT: Number.parseInt(process.env.PORT || '3000'),

	/**
	 * PIPELINE
	 */
	SKIP_VERIFY_PRESENT_FILES: /true/i.test(
		process.env.SKIP_VERIFY_PRESENT_FILES || 'true',
	),
	SKIP_ORGANIZE_PRESENT_FILES: /true/i.test(
		process.env.SKIP_ORGANIZE_PRESENT_FILES || 'true',
	),
	SKIP_UPDATE_METADATA_PRESENT_FILES: /true/i.test(
		process.env.SKIP_UPDATE_METADATA_PRESENT_FILES || 'true',
	),
	SKIP_DOWNLOADS: /true/i.test(process.env.SKIP_DOWNLOADS || 'false'),
	SKIP_POSTERS: /true/i.test(process.env.SKIP_POSTERS || 'false'),

	METADATA_POSTER_SET: process.env.METADATA_POSTER_SET || 'default',

	INCLUDE_SPECIALS: /true/i.test(process.env.INCLUDE_SPECIALS || 'false'),
	PREFER_EXTENDED: /true/i.test(process.env.PREFER_EXTENDED || 'false'),

	FILTERS_INCLUDE: process.env.FILTERS_INCLUDE || '',
	FILTERS_EXCLUDE: process.env.FILTERS_EXCLUDE || '',

	/**
	 * MOUNT
	 */
	MOUNT_LIBRARY_MEDIA_SERVER:
		process.env.MOUNT_LIBRARY_MEDIA_SERVER ||
		process.env.MOUNT_LIBRARY_PLEX ||
		'',
	MOUNT_LIBRARY_ONEPACERR: process.env.MOUNT_LIBRARY_ONEPACERR || '',

	MOUNT_DOWNLOADS_QBITTORRENT: process.env.MOUNT_DOWNLOADS_QBITTORRENT || '',
	MOUNT_DOWNLOADS_ONEPACERR: process.env.MOUNT_DOWNLOADS_ONEPACERR || '',

	/**
	 * LIBRARY
	 */
	LIBRARY_MEDIA_SERVER: process.env.LIBRARY_MEDIA_SERVER || `plex`,

	LIBRARY_SERIES_NAME:
		process.env.LIBRARY_SERIES_NAME ||
		process.env.PLEX_SERIES_NAME ||
		'One Pace',
	LIBRARY_SERIES_FOLDER_NAME:
		process.env.LIBRARY_SERIES_FOLDER_NAME ||
		process.env.PLEX_SERIES_FOLDER_NAME ||
		process.env.LIBRARY_SERIES_NAME ||
		process.env.PLEX_SERIES_NAME ||
		'One Pace',
	LIBRARY_FILENAME_FORMAT:
		process.env.LIBRARY_FILENAME_FORMAT ||
		process.env.PLEX_FILENAME_FORMAT ||
		'{SERIES_NAME} - S{ARC}E{EPISODE} - {TITLE}.mkv',
	LIBRARY_CREATE_SHOW_IF_NOT_FOUND: /true/i.test(
		process.env.LIBRARY_CREATE_SHOW_IF_NOT_FOUND || 'true',
	),

	/**
	 * LIBRARY - NONE
	 */
	LIBRARY_NONE_ROOT_FOLDER:
		process.env.LIBRARY_NONE_ROOT_FOLDER || '%UserProfile%\Downloads\OnePacerr',

	/**
	 * LIBRARY - PLEX
	 */
	PLEX_URL: process.env.PLEX_URL || 'http://localhost:32400',
	PLEX_TOKEN: process.env.PLEX_TOKEN || null,
	PLEX_LIBRARY_NAME: process.env.PLEX_LIBRARY_NAME || 'TV Shows',

	/**
	 * LIBRARY - JELLYFIN
	 */
	JELLYFIN_URL: process.env.JELLYFIN_URL || 'http://localhost:8096',
	JELLYFIN_USERNAME: process.env.JELLYFIN_USERNAME || null,
	JELLYFIN_PASSWORD: process.env.JELLYFIN_PASSWORD || null,
	JELLYFIN_LIBRARY_NAME: process.env.JELLYFIN_LIBRARY_NAME || 'Shows',

	/**
	 * EMBY - JELLYFIN
	 */
	EMBY_URL: process.env.EMBY_URL || 'http://localhost:8096',
	EMBY_USERNAME: process.env.EMBY_USERNAME || null,
	EMBY_PASSWORD: process.env.EMBY_PASSWORD || null,
	EMBY_LIBRARY_NAME: process.env.EMBY_LIBRARY_NAME || 'Shows',

	/**
	 * TORRENT
	 */
	TORRENT_URL: process.env.TORRENT_URL || `http://localhost:80`,
	TORRENT_USER: process.env.TORRENT_USER || `user`,
	TORRENT_PASSWORD: process.env.TORRENT_PASSWORD || `password`,

	//TODO revert after implementing different torrent clients
	TORRENT_CLIENT: `qbittorrent`,
	//TORRENT_CLIENT: process.env.TORRENT_CLIENT || `qbittorrent`,

	TORRENT_CATEGORY: process.env.TORRENT_CATEGORY || `onepacerr`,
	TORRENT_CATEGORY_ONCE_COMPLETED:
		process.env.TORRENT_CATEGORY_ONCE_COMPLETED || `completed`,

	TORRENT_CHECK_INTERVAL:
		Number.parseInt(process.env.TORRENT_CHECK_INTERVAL || '60') * 1000,

	/**
	 * METADATA
	 */
	METADATA_URL:
		process.env.METADATA_URL ||
		`https://raw.githubusercontent.com/ladyisatis/one-pace-metadata/refs/heads/v2/metadata/data.json`,
	METADATA_LANGUAGE: process.env.METADATA_LANGUAGE || 'en',
	METADATA_CHECK_INTERVAL:
		Number.parseInt(process.env.METADATA_CHECK_INTERVAL || '3600') * 1000,
}
