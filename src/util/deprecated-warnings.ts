import Logger from './logger.js'

export default function deprecatedWarnings() {
	if (process.env.PLEX_FILENAME_FORMAT) {
		Logger.warn(
			`You have configured 'PLEX_FILENAME_FORMAT'. This has been renamed to 'LIBRARY_FILENAME_FORMAT' to accomodate different Media Servers than Plex, please update accordingly before the automatic correction for it is removed.`,
		)
	}
	if (process.env.PLEX_SERIES_NAME) {
		Logger.warn(
			`You have configured 'PLEX_SERIES_NAME'. This has been renamed to 'LIBRARY_SERIES_NAME' to accomodate different Media Servers than Plex, please update accordingly before the automatic correction for it is removed.`,
		)
	}
	if (process.env.PLEX_SERIES_FOLDER_NAME) {
		Logger.warn(
			`You have configured 'PLEX_SERIES_FOLDER_NAME'. This has been renamed to 'LIBRARY_FILENAME_FORMAT' to accomodate different Media Servers than Plex, please update accordingly before the automatic correction for it is removed.`,
		)
	}
	if (process.env.MOUNT_LIBRARY_PLEX) {
		Logger.warn(
			`You have configured 'MOUNT_LIBRARY_PLEX'. This has been renamed to 'MOUNT_LIBRARY_MEDIA_SERVER' to accomodate different Media Servers than Plex, please update accordingly before the automatic correction for it is removed.`,
		)
	}

	if (process.env.PLEX_CREATE_SHOW_IF_NOT_FOUND) {
		Logger.warn(
			`You have configured 'PLEX_CREATE_SHOW_IF_NOT_FOUND'. This has been renamed to 'LIBRARY_CREATE_SHOW_IF_NOT_FOUND ' to accomodate different Media Servers than Plex, please update accordingly before the automatic correction for it is removed.`,
		)
	}
	if (process.env.MOUNT_DOWNLOADS_QBITTORRENT) {
		Logger.warn(
			`You have configured 'MOUNT_DOWNLOADS_QBITTORRENT'. This has been renamed to 'MOUNT_DOWNLOADS_TORRENT' to accomodate different Torrenting Clients, please update accordingly before the automatic correction for it is removed.`,
		)
	}
}
