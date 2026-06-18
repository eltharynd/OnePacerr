# ![OnePacerr](docs/logo.png)

![GitHub Packages](https://img.shields.io/badge/ghcr.io-eltharynd%2Fonepacerr-blue?style=flat-square&logo=github)
![GitHub Release](https://img.shields.io/github/v/release/eltharynd/onepacerr?style=flat-square)
![GitHub Issues](https://img.shields.io/github/issues/eltharynd/onepacerr?style=flat-square)
![GitHub Last Commit](https://img.shields.io/github/last-commit/eltharynd/onepacerr?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

**OnePacerr** is a standalone, automated One Pace download tool designed specifically for
Sonarr/Plex Home Server setups.

Because Sonarr does not natively support [One
Pace](https://onepace.net/) (the fan-edited, manga-accurate version of One Piece), this app
bridges the gap by automatically downloading, organizing, and keeping your One Pace
episodes fully up to date, as well as adding metadata and custom posters for them in Plex.

## 📃 Table of Contents

- ✨ [Features](#-features)
- 🧪 [Pipeline](#-pipeline)
- 🚀 [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - 📝 [Recommended configs](#-recommended-configs)
    - 🐔 [Base Operation](#-base-operation)
    - 🐣 [First Run](#-first-run)
  - [Installation](#installation)
- ⚙️ [Environment Variables Explained](#️-environment-variables-explained)
- 📅 [Roadmap](#-roadmap)
- 🤝 [Credits & Acknowledgements](#-credits--acknowledgements)
- 💗 [Support (One Pace, not me!)](#-support-one-pace-not-me)

## ✨ Features

- **Automated Discovery:** Continuously pulls One Pace's RSS Release feed and
  metadata to detect new episodes.
- **Smart Library Scanning:** Scans your existing Plex library to compare available
  episodes against your local files.
- **File Verification (Optional):** Hashes existing files to ensure they match the latest
  releases and automatically re-downloads outdated versions.
- **File Organization (Optional):** Scans your existing Plex library and renames files accordingly when needed.
- **Seamless Downloading (Optional):** Automatically sends `magnetURI` links to qBittorrent for
  missing episodes.

- **qBittorrent Monitoring (Optional):** Tracks download progress. Once completed, it:
  - Copies and renames the file to your designated Plex Library folder.
  - Updates the metadata directly on Plex.
  - Assigns a custom (`completed`) category to the processed torrents in qBittorrent.

## 🧪 Pipeline

The following diagram tries to explain the process in a simple way

![pipeline](docs/pipeline.png?cache=2)

The RSS only refreshes when trying to get a magnetURI and it's not in RSS. This is possible because metadata is only updated after RSS is, so there's no need to refresh both periodically.

tldr: the RSS Feed refresh is triggered by metadata having updates.

## 🚀 Getting Started

### Prerequisites

Before running OnePacerr, ensure you have the following services up and running:

- **Docker & Docker Compose** (or k8s, or custom app in Truenas or equivalent)
- **Plex Media Server**
- **qBittorrent** (with WebUI enabled)

### 📝 Recommended configs

#### 🐔 Base Operation

If your files are nicely named and organized and if Plex has all the metadata, you can safely leave these as false (true) or not declare them at all:

```bash
# 🐔 BASE CONFIG WHEN YOUR LIBRARY IS ALREADY WELL ORGANIZED
SKIP_VERIFY_PRESENT_FILES=true
SKIP_ORGANIZE_PRESENT_FILES=true
SKIP_UPDATE_METADATA_PRESENT_FILES=true
```

This will prevent the app to verify the files you already have downloaded (CRC32 hashing can take a while depending on your machine).

#### 🐣 First Run

In fact my recommendation is to:

- running the app one with both set to `false`. This makes sure your current library is up to date and all metadata is there.
- afterwards always run the app with both to `true`. This will avoid checking files you already checked on first run.

```bash
# 🐣 RECOMMENDED CONFIG FOR FIRST RUN
SKIP_VERIFY_PRESENT_FILES=false
SKIP_ORGANIZE_PRESENT_FILES=false
SKIP_UPDATE_METADATA_PRESENT_FILES=false
```

### Installation

The recommended way to install and run OnePacerr is via `docker-compose`.

Create a `docker-compose.yml` file and copy the configuration below. Make sure to update
the environment variables and volume mounts to match your server's setup.

I listed all variables commenting out the defaults for convenience.

```yaml
services:
  onepacerr:
    image: ghcr.io/eltharynd/onepacerr:latest
    container_name: onepacerr
    restart: unless-stopped
    environment:
      - TZ=Europe/Zurich
      - PUID=568
      - PGID=568

      #- DEBUGGING=false

      # qBittorrent Settings
      - TORRENT_URL=localhost:8080
      - TORRENT_USER=<your-username-here>
      - TORRENT_PASSWORD=<your-password-here>
      #- TORRENT_CATEGORY=onepacerr
      #- TORRENT_CATEGORY_ONCE_COMPLETED=completed
      #- TORRENT_CHECK_INTERVAL=30

      # File & Metadata Management
      - SKIP_VERIFY_PRESENT_FILES=false
      - SKIP_ORGANIZE_PRESENT_FILES=false
      - SKIP_UPDATE_METADATA_PRESENT_FILES=false
      #- SKIP_DOWNLOADS=false
      #- SKIP_POSTERS=false

      #- INCLUDE_SPECIALS=false
      - PREFER_EXTENDED=true

      # Metadata Settings
      #- METADATA_URL=raw.githubusercontent.com/ladyisatis/one-pace-metadata/refs/heads/v2metadata/data.json
      #- METADATA_LANGUAGE=en
      #- METADATA_CHECK_INTERVAL=3600

      # Cross-Mount Mapping (Uncomment if needed, defaults to nothing)
      #- MOUNT_LIBRARY_PLEX=/mnt/Library/Series
      #- MOUNT_LIBRARY_ONEPACERR=\\TRUENAS\series
      #- MOUNT_DOWNLOADS_QBITTORRENT=/mnt/Applications/Downloads
      #- MOUNT_DOWNLOADS_ONEPACERR=\\TRUENAS\downloads

      # Plex Settings
      - PLEX_URL=localhost:32400
      - PLEX_TOKEN=<your-token-here>
      - PLEX_LIBRARY_NAME=TV Shows
      - PLEX_SERIES_NAME=One Pace
      #- PLEX_SERIES_FOLDER_NAME=One Pace
      #- PLEX_FILENAME_FORMAT={SERIES_NAME} - S{ARC}E{EPISODE} - {TITLE}.mkv
      #- PLEX_CREATE_SHOW_IF_NOT_FOUND=true

    volumes:
      - /mnt/Library/Movies:/mnt/Library/Movies
      - /mnt/Library/Series:/mnt/Library/Series
      - /mnt/Applications/Downloads:/mnt/Applications/Downloads
```

## ⚙️ Environment Variables Explained

Here is a breakdown of key optional variables you can adjust in your
`docker-compose.yml`:

- ⭐ Mandatory
- 🍤 Can leave empty but double check default matches plex
- 🍏 Useful

| Pipeline Variables | Default | Description |
| :--- | :--- | :--- |
| 🍏 `SKIP_VERIFY_PRESENT_FILES` | `true` | If `false`, hashes files present in Plex upon metadata updates to ensure they are the latest/wanted versions. |
| 🍏 `SKIP_ORGANIZE_PRESENT_FILES` | `true` | If `false`, makes sure the files existing on plex are in the correct folder and named correctly. |
| 🍏 `SKIP_UPDATE_METADATA_PRESENT_FILES` | `true` | If `false`, automatically updates metadata for files already in your Plex library, otherwise only does so for new downloads. |
| 🍏 `SKIP_DOWNLOADS` | `false` | If `true`, skips download. Use if you only want to organize your current files |
| 🍏 `SKIP_POSTERS` | `false` | If `true`, skips updating posters when updating metadata. |
| --- | --- | --- |
| `INCLUDE_SPECIALS` | `false` | Set to `true` to also process specials. |
| `PREFER_EXTENDED` | `false` | Set to `true` to prioritize extended cuts over standard releases. |

| Server Configuration Variables | Default | Description |
| :--- | :--- | :--- |
| `MOUNT_LIBRARY_PLEX` | _None_ | Use these mapping variables if **Plex** uses different mount paths than the OnePacerr container. |
| `MOUNT_LIBRARY_ONEPACERR` | _None_ | Use these mapping variables if **Plex** uses different mount paths than the OnePacerr container. |
| `MOUNT_DOWNLOADS_QBITTORRENT` | _None_ | Use these mapping variables if **qBittorrent** uses different mount paths than the OnePacerr container. |
| `MOUNT_DOWNLOADS_ONEPACERR` | _None_ | Use these mapping variables if **qBittorrent** uses different mount paths than the OnePacerr container. |

| Plex Variables | Default | Description |
| :--- | :--- | :--- |
| ⭐ `PLEX_URL` | `http://localhost:32400` | Plex URL. |
| ⭐ `PLEX_TOKEN` | _None_ | Your [Plex Token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/). |
| 🍤 `PLEX_LIBRARY_NAME` | `TV Shows` | Name of the Library in Plex. |
| 🍤 `PLEX_SERIES_NAME` | `One Pace` | Name of the Series in Plex. |
| `PLEX_SERIES_FOLDER_NAME` | `PLEX_SERIES_NAME` | Override when the Plex folder needs to be called differently from `PLEX_SERIES_NAME`. |
| `PLEX_FILENAME_FORMAT` | `{SERIES_NAME} - S{ARC}E{EPISODE} - {TITLE}.mkv` | Overrides the filename each file should have, `{SERIES_NAME}`, `{ARC}`, `{EPISODE}` and `{TITLE}` will be replaced with values. `.mkv` automatically added if not specified |
| `PLEX_CREATE_SHOW_IF_NOT_FOUND` | `true` | If `false`, the app crashes if "One Pace" isn't already on Plex (useful for catching typos on first setup). Set to `true` to auto-create the show. |

| Torrent Variables | Default | Description |
| :--- | :--- | :--- |
| ⭐ `TORRENT_URL` | `http://localhost:80` | Your qBittorrent webUI URL. |
| ⭐ `TORRENT_USER` | _None_ | Your qBittorrent webUI username. |
| ⭐ `TORRENT_PASSWORD` | _None_ | Your qBittorrent webUI password. |
| `TORRENT_CATEGORY` | `onepacerr` | Creates downloads with this category, also filters completed torrents using this. |
| `TORRENT_CATEGORY_ONCE_COMPLETED` | `completed` | After processing completed downloads, changes the torrent category to this one. |
| `TORRENT_CHECK_INTERVAL` | `30` | Seconds between checking for completed downloads. |

| Metadata Variables | Default | Description |
| :--- | :--- | :--- |
| `METADATA_URL` | `https://raw.githubusercontent.com/ladyisatis/one-pace-metadata/refs/heads/v2/metadata/data.json` | Metadata url (untested with different ones). |
| `METADATA_LANGUAGE` | `en` | Currently only language supported. |
| `METADATA_CHECK_INTERVAL` | `3600` | Seconds between checking for new metadata. |

## 📅 Roadmap

- [x] **Custom folder/files names** (since v1.0.12)
- [x] **Organize Library (rename/move)** (since v1.0.12)
- [x] **Skip Download** (since v1.0.12)
- [ ] **Handle RSS/Metadata fetch failures** with a delayed retry or something...
- [ ] **Rest API** Manual execution endpoints
- [ ] **Support alternate torrent clients**
- [ ] **Poster settings to chose either official/alternate or customs**
- [ ] **Jellyfin Support** _(Requested by Marci)_
- [Request a new feature](https://github.com/eltharynd/OnePacerr/issues)

## 🤝 Credits & Acknowledgements

This project wouldn't be possible without the incredible work of the community:

- **[One Pace](https://onepace.net/en):** The incredible team behind the unofficial fan edits.
- **[Ladyisatis](https://github.com/ladyisatis):** For maintaining the
  [one-pace-metadata](https://github.com/ladyisatis/one-pace-metadata) repository.
- **[/u/piratezekk](https://reddit.com/user/piratezekk):** For the custom poster artwork.

## 💗 Support (One Pace, not me!)

Please **do not** donate to me for this tool.

Instead, please show your support for the team
doing the heavy lifting by backing **[One Pace on Patreon](https://patreon.com/onepace)**.

[Go Back up](#-table-of-contents)
