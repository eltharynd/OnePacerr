# ![OnePacerr](docs/logo.png)

![GitHub Packages](https://img.shields.io/badge/ghcr.io-eltharynd%2Fonepacerr-blue?style=flat-square&logo=github)
![GitHub Release](https://img.shields.io/github/v/release/eltharynd/onepacerr?style=flat-square)
![GitHub Issues](https://img.shields.io/github/issues/eltharynd/onepacerr?style=flat-square)
![GitHub Last Commit](https://img.shields.io/github/last-commit/eltharynd/onepacerr?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

**OnePacerr** is a standalone, automated One Pace download tool designed specifically to complement Sonarr in Home Server setups.

Because Sonarr does not natively support [One
Pace](https://onepace.net/) (the fan-edited, manga-accurate version of One Piece), this app
bridges the gap by automatically downloading, organizing, and keeping your One Pace
episodes fully up to date, as well as adding metadata and custom posters for your Media Server.

Other than downloading and organizing your episode files, it also updates metadata and posters so that it looks nice and professional on your Media Server setups.

![Plex](docs/plex.png) ![Jellyfin](docs/jellyfin.png)

We plan to support as many Media Severs as possible, the following is the current status of the implementation:

- **Local Folder**: ✅ Implemented.
- **Plex Media Server**: ✅ Implemented.
- **Jellyfin**: ✅ Implemented.
- **Emby**: ❌ Will implement after jellyfin, don't have a deadline for you

## 📃 Table of Contents

- ✨ [Features](#-features)
- 🧪 [Pipeline](#-pipeline)
- 🚀 [Getting Started](#-getting-started)
  - 🧳 [Prerequisites](#-prerequisites)
  - 📝 [Recommended configs](#-recommended-configs)
    - 🐔 [Base Operation](#-base-operation)
    - 🐣 [First Run](#-first-run)
- ⚡ [Usage](#-usage)
  - 🐳 [Deploy via Docker](#-deploy-via-docker)
  - 🟢 [Running locally](#-running-locally)
  - 👩‍💻 [Contributing to the development](#-contributing-to-the-development)

- ⚙️ [Environment Variables Explained](#️-environment-variables-explained)
- 🖼️ [Poster Sets](#️-poster-sets)
  - 🔍 [Previews](#-previews)
  - 📥 [Adding/Updating Sets](#-addingupdating-sets)
- 📅 [Roadmap](#-roadmap)
- 🤝 [Credits & Acknowledgements](#-credits--acknowledgements)
- 💗 [Support (One Pace, not me!)](#-support-one-pace-not-me)

## ✨ Features

- **Automated Discovery:** Continuously pulls One Pace's RSS Release feed and
  metadata to detect new episodes.
- **Smart Library Scanning:** Scans your existing Media Server (Plex, Jellyfin, Emby) or Local Folder Library to compare latest episodes against your local files.
- **File Verification (Optional):** Hashes existing files to ensure they match the latest
  releases and automatically re-downloads outdated versions.
- **File Organization (Optional):** Scans your existing Media Server (Plex, Jellyfin, Emby) or Local Folder library and renames files accordingly when needed.
- **Seamless Downloading (Optional):** Automatically sends `magnetURI` links to qBittorrent for
  missing episodes.

- **qBittorrent Monitoring (Optional):** Tracks download progress. Once completed, it:
  - Copies and renames the file to your designated Library folder.
  - Updates the metadata either directly on your Media Server (Plex, Jellyfin, Emby) or creates the files on your Local Folder for later imports.
  - Assigns a custom (`completed`) category to the processed torrents in qBittorrent.

## 🧪 Pipeline

The following diagram tries to explain the process in a simple way

![pipeline](docs/pipeline.png?cache=2)

The RSS only refreshes when trying to get a magnetURI and it's not in RSS. This is possible because metadata is only updated after RSS is, so there's no need to refresh both periodically.

tldr: the RSS Feed refresh is triggered by metadata having updates.

## 🚀 Getting Started

### 🧳 Prerequisites

Before running OnePacerr, ensure you have the following services up and running:

- **Docker & Docker Compose** (or k8s, or custom app in Truenas or equivalent)
  - Alternatively you can run it locally with node.
    - create a `.env` file in root (use `sample.env` as example)
    - `npm install`
    - `npm start`
- [**qBittorrent**](https://hub.docker.com/r/linuxserver/qbittorrent) (with WebUI enabled)
  - More torrenting clients coming
- You can also just organize a Local Folder, but usually people use this to organize their media server:
  - [**Plex Media Server**](https://hub.docker.com/r/linuxserver/plex)
  - [**Jellyfin**](https://hub.docker.com/r/linuxserver/jellyfin)
  - [**Emby**](https://hub.docker.com/r/linuxserver/emby)

### 📝 Recommended configs

#### 🐔 Base Operation

If your files are nicely named and organized and if Plex has all the metadata, you can safely leave these as true (default) or not declare them at all:

```dotenv
# 🐔 BASE CONFIG WHEN YOUR LIBRARY IS ALREADY WELL ORGANIZED
SKIP_VERIFY_PRESENT_FILES=true
SKIP_ORGANIZE_PRESENT_FILES=true
SKIP_UPDATE_METADATA_PRESENT_FILES=true
```

This will prevent the app to verify hash (CRC32 hashing can take a while depending on your machine), to verify plex file names (and rename where nexessary) and to update the metadata on plex for **the files that are already present on Plex**.

#### 🐣 First Run

My recommendation **when plex already has some/all of the episodes** is to run it once with the following configs, so that every file is gonna get verified to be up to date and all metadata is gonna be imported.

```dotenv
# 🐣 RECOMMENDED CONFIG FOR FIRST RUN
SKIP_VERIFY_PRESENT_FILES=false
SKIP_ORGANIZE_PRESENT_FILES=false
SKIP_UPDATE_METADATA_PRESENT_FILES=false
```

After the app is done processing all of the present seasons/episodes, it's gonna continue monitoring for completed downloads and import as usual.

You can also optionally disable downloads for this first run, then stop the app once it's done and update the env vars to keep it running with the basic config.

## ⚡ Usage

### 🐳 Deploy via Docker

The recommended way to deploy is via `docker-compose`.

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

      # General
      #- DEBUGGING=false



      # Pipeline
      - SKIP_VERIFY_PRESENT_FILES=false
      - SKIP_ORGANIZE_PRESENT_FILES=false
      - SKIP_UPDATE_METADATA_PRESENT_FILES=false
      #- SKIP_DOWNLOADS=false
      #- SKIP_POSTERS=false

      #- INCLUDE_SPECIALS=false
      - PREFER_EXTENDED=true



      # Cross-Mount Mappings (Uncomment if needed, defaults to nothing)
      #- MOUNT_LIBRARY_MEDIA_SERVER=/mnt/Library/Series
      #- MOUNT_LIBRARY_ONEPACERR=\\TRUENAS\series
      #- MOUNT_DOWNLOADS_QBITTORRENT=/mnt/Applications/Downloads
      #- MOUNT_DOWNLOADS_ONEPACERR=\\TRUENAS\downloads




      # Library 
      - LIBRARY_MEDIA_SERVER=plex 
      - LIBRARY_SERIES_NAME=One Pace
      #- LIBRARY_SERIES_FOLDER_NAME=One Pace

      #- LIBRARY_FILENAME_FORMAT={SERIES_NAME} - S{ARC}E{EPISODE} - {TITLE}.mkv
      #- LIBRARY_CREATE_SHOW_IF_NOT_FOUND=true


      # Library - None
      #- LIBRARY_NONE_ROOT_FOLDER=C:\\OnePacerr

      # Library - Plex
      - PLEX_URL=localhost:32400
      - PLEX_TOKEN=<your-token-here>
      - PLEX_LIBRARY_NAME=TV Shows




      # Torrent Settings
      - TORRENT_URL=localhost:8080
      - TORRENT_USER=<your-username-here>
      - TORRENT_PASSWORD=<your-password-here>
      - TORRENT_CLIENT=qbittorrent
      #- TORRENT_CATEGORY=onepacerr
      #- TORRENT_CATEGORY_ONCE_COMPLETED=completed
      #- TORRENT_CHECK_INTERVAL=60



      # Metadata Settings
      #- METADATA_URL=raw.githubusercontent.com/ladyisatis/one-pace-metadata/refs/heads/v2metadata/data.json
      #- METADATA_LANGUAGE=en
      #- METADATA_CHECK_INTERVAL=3600
      #- METADATA_POSTER_SET=default
    volumes:
      - /mnt/Library/Movies:/mnt/Library/Movies
      - /mnt/Library/Series:/mnt/Library/Series
      - /mnt/Applications/Downloads:/mnt/Applications/Downloads
```

### 🟢 Running locally

Install node (>24 tested) on your machine then:

- create a `.env` file in root (use `sample.env` as example)
- `npm install`
- `npm start`

### 👩‍💻 Contributing to the development

For developing first install dependencies:

```bash
npm i
```

I recommend opening two side-by side tabs in vs code terminal and running one of these in each:

```bash
#Compiles typescript and watch for changes
tsc -w

#Shortcut for nodemon --enable-source-maps dist/index.js
#runs app and reloads any time tsc-w recompiles an edited file
npm run dev
```

## ⚙️ Environment Variables Explained

Here is a breakdown of key optional variables you can adjust in your
`docker-compose.yml` or in your `.env` file:

- ⭐ Mandatory
- 🍤 Can leave empty but double check default works for you
- 🍏 Useful
- 💭 These configuration are specific to your chosen Media Server type (`$LIBRARY_MEDIA_SERVER`) so you only need to specify the ones for your case.

### General

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

| Mount Configuration Variables | Default | Description |
| :--- | :--- | :--- |
| `MOUNT_LIBRARY_MEDIA_SERVER` | _None_ | Use these mapping variables if your **Media Server** uses different mount paths than the OnePacerr container. |
| `MOUNT_LIBRARY_ONEPACERR` | _None_ | Use these mapping variables if your **Media Server** uses different mount paths than the OnePacerr container. |
| `MOUNT_DOWNLOADS_QBITTORRENT` | _None_ | Use these mapping variables if **qBittorrent** uses different mount paths than the OnePacerr container. |
| `MOUNT_DOWNLOADS_ONEPACERR` | _None_ | Use these mapping variables if **qBittorrent** uses different mount paths than the OnePacerr container. |

### Library (Common)

> [!IMPORTANT]  
> Configure the Library (Media Server) type here.
>
> `none` just organizes files in a folder, when metadata is updated it creates `.plexmatch`, `.nfo`, `poster.png` and all of the files that can be then used to automatically add metadata if imported to a Media Server at a later time.
>
> `plex` Plex Media Server.
>
> `jellyfin` Jellyfin Media Server.
>
> `emby` coming soon.

| Library Variables | Default | Description |
| :--- | :--- | :--- |
| ⭐ `LIBRARY_MEDIA_SERVER` | `plex` | Media server, can be either `plex`, `jellyfin`, `emby` or `none` if you just want to organize files in a folder. |
| 🍤 `LIBRARY_SERIES_NAME` | `One Pace` | Name of the Series in Plex. |
| `LIBRARY_SERIES_FOLDER_NAME` | `$LIBRARY_SERIES_NAME` | Override when the Plex folder needs to be called differently from `LIBRARY_SERIES_NAME`. |
| `LIBRARY_FILENAME_FORMAT` | `{SERIES_NAME} - S{ARC}E{EPISODE} - {TITLE}.mkv` | Overrides the filename each file should have, `{SERIES_NAME}`, `{ARC}`, `{EPISODE}` and `{TITLE}` will be replaced with values. `.mkv` automatically added if not specified. |
| `LIBRARY_CREATE_SHOW_IF_NOT_FOUND` | `true` | If `false`, the app crashes if "LIBRARY_SERIES_NAME" isn't already a Show in your Media Server (useful for catching typos on first setup). Leave `true` to auto-create the show. |

### Library (Local Folder)

| 💭 Library - None | Default | Description |
| :--- | :--- | :--- |
| 🍤 `LIBRARY_NONE_ROOT_FOLDER` | `C:\\OnePacerr` | The root folder where your Library should be saved (Do not Include LIBRARY_SERIES_FOLDER_NAME). |

### Library (Plex Media Server)

| 💭 Library - Plex Variables | Default | Description |
| :--- | :--- | :--- |
| ⭐ `PLEX_URL` | `http://localhost:32400` | Plex URL. |
| ⭐ `PLEX_TOKEN` | _None_ | Your [Plex Token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/). |
| 🍤 `PLEX_LIBRARY_NAME` | `TV Shows` | Name of the Library in Plex. |

### Library (Jellyfin)

| 💭 Library - Jellyfin Variables | Default | Description |
| :--- | :--- | :--- |
| ⭐ `JELLYFIN_URL` | `http://localhost:8096` | Jellyfin URL. |
| ⭐ `JELLYFIN_USERNAME` | _None_ | Your Jellyfin username. |
| ⭐ `JELLYFIN_PASSWORD` | _None_ | Your Jellyfin password. |
| 🍤 `JELLYFIN_LIBRARY_NAME` | `Shows` | Name of the Library in Jellyfin. |

| Torrent Variables | Default | Description |
| :--- | :--- | :--- |
| 🍤 `TORRENT_CLIENT` | `qbittorrent` | Your torrent client. Will be used in the future to use different clients rather tnax qBittorrent. |
| ⭐ `TORRENT_URL` | `http://localhost:80` | Your torrent API URL. |
| ⭐ `TORRENT_USER` | _None_ | Your torrent API username. |
| ⭐ `TORRENT_PASSWORD` | _None_ | Your torrent API password. |
| `TORRENT_CATEGORY` | `onepacerr` | Creates downloads with this category, also filters completed torrents using this. |
| `TORRENT_CATEGORY_ONCE_COMPLETED` | `completed` | After processing completed downloads, changes the torrent category to this one. |
| `TORRENT_CHECK_INTERVAL` | `60` | Seconds between checking for completed downloads. |

| Metadata Variables | Default | Description |
| :--- | :--- | :--- |
| `METADATA_URL` | `https://raw.githubusercontent.com/ladyisatis/one-pace-metadata/refs/heads/v2/metadata/data.json` | Metadata url (untested with different ones). |
| `METADATA_LANGUAGE` | `en` | Currently only language supported. |
| `METADATA_POSTER_SET` | `default` | Currently `default` equals `piratezekk`. There are also `official` and `mizzoufan523` available. If a set is missing a poster it uses `default`. |
| `METADATA_CHECK_INTERVAL` | `3600` | Seconds between checking for new metadata. |

## 🖼️ Poster Sets

### 🔍 Previews

You can preview all of the custom poster sets at the following links:

- [piratezekk (default)](docs/poster%20previews/piratezekk.md#show)
- [mizzoufan523](docs/poster%20previews/mizzoufan523.md#show)
- [official](docs/poster%20previews/official.md#show)

When a poster is missing from the set, you will se a placeholder in these preview.

When updating metadata, a missing poster results in falling back to default.

### 📥 Adding/Updating Sets

If you want to contribute to the posters or create an entire new set, first of all I love you, then please [read this](POSTER-SETS.md#how-to-contribute-to-poster-sets).

## 📅 Roadmap

- [x] **Poster settings to chose either official/alternate or customs** (since v1.1.1)
- [x] **Handle Network failures** with a delayed retry or something... (since v1.2.0)
- [X] **Remove Plex requirement** for when someone just wants to organize a standalone folder (since v1.2.0)
  - Do so by refactoring PlexController with Factory style so new LibraryControllers can be more easily implemented. This would speed up Jellyfin/Kodi/Emby implementation considerally. Treat no media server the same way just organizing a folder and creating .plexmatch .nfo and such
- [X] **Local Folder Metadata** files creation so that they can later be moved to any Media Server (since v1.3.0)
- [X] **Jellyfin Support** _(Requested by Marci on Discord)_ (since v1.3.0)
- [ ] **Jellyfin alternate Auth methods**
- [ ] **Emby Support** _(Requested by u/RealJustMe on r/Servarr)_
- [ ] **Add posters via path** to reduce plex metadata update time...
- [ ] **Filters** to skip seasons/episodes
- [ ] **Rest API** Manual execution/status/configuration endpoints
- [ ] **Support alternate torrent clients** (thinking uTorrent and deluge)
- [ ] **Support Plex/Jellyfin Libraries with multiple folders** (currently only gets the first result from API)

- [Request a new feature](https://github.com/eltharynd/OnePacerr/issues)

## 🤝 Credits & Acknowledgements

This project wouldn't be possible without the incredible work of the community:

- **[One Pace](https://onepace.net/en):** The incredible team behind the unofficial fan edits.
- **[Ladyisatis](https://github.com/ladyisatis):** For maintaining the
  [one-pace-metadata](https://github.com/ladyisatis/one-pace-metadata) repository.
- For the custom poster artwork sets:
  - `piratezekk` (default) by **[/u/piratezekk](https://reddit.com/user/piratezekk)**.
  - `mizzoufan523` by **[/u/Mizzoufan523](https://reddit.com/user/Mizzoufan523)**.
  - `official` by **[One Pace's Team](https://onepace.net/en)**

## 💗 Support (One Pace, not me!)

Please **do not** donate to me for this tool.

Instead, please show your support for the team
doing the heavy lifting by backing **[One Pace](https://onepace.net)**.

[Go Back up](#-table-of-contents)
