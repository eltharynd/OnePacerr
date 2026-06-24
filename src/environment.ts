import dotenv from 'dotenv'
import { Logger } from 'ez-ts-logger'
import deprecatedWarnings from './util/deprecated-warnings.js'
dotenv.config({ path: './.env' })

export default {
	LOG_LEVEL: process.env.LOG_LEVEL || 'info',
	DEBUGGING:
		/debug/i.test(process.env.LOG_LEVEL || 'false') ||
		/true/i.test(process.env.DEBUGGING || 'false'),

	TESTING:
		/test/i.test(process.env.NODE_ENV) || /true/i.test(process.env.TESTING),

	DOMAIN: process.env.DOMAIN || 'localhost',
	API_BASE: process.env.API_BASE || '/api/v1/',
	PORT: Number.parseInt(process.env.PORT || '3000'),

	/**
	 * PIPELINE
	 */
	PIPELINE_SKIP_VERIFY_PRESENT_FILES: /true/i.test(
		process.env.PIPELINE_SKIP_VERIFY_PRESENT_FILES ||
			process.env.SKIP_VERIFY_PRESENT_FILES ||
			'true',
	),
	PIPELINE_SKIP_VERIFY_NOT_FOR_EXTENDED: /true/i.test(
		process.env.PIPELINE_SKIP_VERIFY_NOT_FOR_EXTENDED || 'false',
	),
	PIPELINE_SKIP_ORGANIZE_PRESENT_FILES: /true/i.test(
		process.env.PIPELINE_SKIP_ORGANIZE_PRESENT_FILES ||
			process.env._SKIP_ORGANIZE_PRESENT_FILES ||
			'true',
	),
	PIPELINE_SKIP_UPDATE_METADATA_PRESENT_FILES: /true/i.test(
		process.env.PIPELINE_SKIP_UPDATE_METADATA_PRESENT_FILES ||
			process.env.SKIP_UPDATE_METADATA_PRESENT_FILES ||
			'true',
	),
	PIPELINE_SKIP_DOWNLOADS: /true/i.test(
		process.env.PIPELINE_SKIP_DOWNLOADS ||
			process.env.SKIP_DOWNLOADS ||
			'false',
	),
	PIPELINE_SKIP_DOWNLOADS_IMPORTS: /true/i.test(
		process.env.SKIP_DOWNLOADS_IMPORTS || 'false',
	),
	PIPELINE_SKIP_POSTERS: /true/i.test(
		process.env.PIPELINE_SKIP_POSTERS || process.env.SKIP_POSTERS || 'false',
	),

	PIPELINE_INCLUDE_SPECIALS: /true/i.test(
		process.env.PIPELINE_INCLUDE_SPECIALS ||
			process.env.INCLUDE_SPECIALS ||
			'false',
	),
	PIPELINE_PREFER_EXTENDED: /true/i.test(
		process.env.PIPELINE_PREFER_EXTENDED ||
			process.env.PREFER_EXTENDED ||
			'false',
	),
	PIPELINE_PREFER_G8: /true/i.test(
		process.env.PREFER_G8 || process.env.PIPELINE_PREFER_G8 || 'false',
	),

	PIPELINE_FILTERS_INCLUDE:
		process.env.PIPELINE_FILTERS_INCLUDE || process.env.FILTERS_INCLUDE || '',
	PIPELINE_FILTERS_EXCLUDE: process.env.PIPELINE_FILTERS_EXCLUDE || '',

	PIPELINE_RETRY_INTERVAL:
		Number.parseInt(process.env.PIPELINE_RETRY_INTERVAL || '10') * 1000,

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
	PLEX_SKIP_METADATA_FILES: /true/i.test(
		process.env.PLEX_SKIP_METADATA_FILES || 'true',
	),
	PLEX_PLEXMATCH_EVEN_IF_NOT: /true/i.test(
		process.env.PLEX_PLEXMATCH_EVEN_IF_NOT || 'false',
	),

	/**
	 * LIBRARY - JELLYFIN
	 */
	JELLYFIN_URL: process.env.JELLYFIN_URL || 'http://localhost:8096',
	JELLYFIN_USERNAME: process.env.JELLYFIN_USERNAME || null,
	JELLYFIN_PASSWORD: process.env.JELLYFIN_PASSWORD || null,
	JELLYFIN_LIBRARY_NAME: process.env.JELLYFIN_LIBRARY_NAME || 'Shows',

	/**
	 * LIBRARY - EMBY
	 */
	EMBY_URL: process.env.EMBY_URL || 'http://localhost:8096',
	EMBY_USERNAME: process.env.EMBY_USERNAME || null,
	EMBY_PASSWORD: process.env.EMBY_PASSWORD || null,
	EMBY_LIBRARY_NAME: process.env.EMBY_LIBRARY_NAME || 'Shows',

	/**
	 * TORRENT
	 */
	TORRENT_URL: process.env.TORRENT_URL || `http://localhost:8080`,
	TORRENT_USER: process.env.TORRENT_USER || `user`,
	TORRENT_PASSWORD: process.env.TORRENT_PASSWORD || `password`,

	TORRENT_CLIENT: process.env.TORRENT_CLIENT || `qbittorrent`,
	TORRENT_CLIENT_TIMEOUT:
		Number.parseInt(process.env.TORRENT_CLIENT_TIMEOUT || '10') * 1000,

	TORRENT_CATEGORY_FORCE: /true/i.test(
		process.env.TORRENT_CATEGORY_FORCE || 'false',
	),
	TORRENT_CATEGORY: process.env.TORRENT_CATEGORY || `onepacerr`,
	TORRENT_CATEGORY_ONCE_COMPLETED:
		process.env.TORRENT_CATEGORY_ONCE_COMPLETED || `completed`,

	TORRENT_CHECK_INTERVAL:
		Number.parseInt(process.env.TORRENT_CHECK_INTERVAL || '60') * 1000,

	/**
	 * MOUNT
	 */
	MOUNT_LIBRARY_MEDIA_SERVER:
		process.env.MOUNT_LIBRARY_MEDIA_SERVER ||
		process.env.MOUNT_LIBRARY_PLEX ||
		'',
	MOUNT_LIBRARY_ONEPACERR: process.env.MOUNT_LIBRARY_ONEPACERR || '',

	MOUNT_DOWNLOADS_TORRENT:
		process.env.MOUNT_DOWNLOADS_TORRENT ||
		process.env.MOUNT_DOWNLOADS_QBITTORRENT ||
		'',
	MOUNT_DOWNLOADS_ONEPACERR: process.env.MOUNT_DOWNLOADS_ONEPACERR || '',

	/**
	 * METADATA
	 */
	METADATA_URL:
		process.env.METADATA_URL ||
		`https://raw.githubusercontent.com/ladyisatis/one-pace-metadata/refs/heads/v2/metadata/data.json`,
	METADATA_LANGUAGE: process.env.METADATA_LANGUAGE || 'en',
	METADATA_POSTER_SET: process.env.METADATA_POSTER_SET || 'default',
	METADATA_CHECK_INTERVAL:
		Number.parseInt(process.env.METADATA_CHECK_INTERVAL || '3600') * 1000,
}

Logger.reloadEnvConfigs()

deprecatedWarnings()
