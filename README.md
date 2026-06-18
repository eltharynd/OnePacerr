# ‍☠️ OnePacerr

![GitHub Packages](https://img.shields.io/badge/ghcr.io-eltharynd%2Fonepacerr-blue?style=flat-square&logo=github)
![GitHub Release](https://img.shields.io/github/v/release/eltharynd/onepacerr?style=flat-square)
![GitHub Issues](https://img.shields.io/github/issues/eltharynd/onepacerr?style=flat-square)
![GitHub Last Commit](https://img.shields.io/github/last-commit/eltharynd/onepacerr?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

**OnePacerr** is a standalone, automated deployment tool designed specifically for
Sonarr/Plex Home Server setups.

Because Sonarr does not natively support [One
Pace](https://onepace.net/) (the fan-edited, manga-accurate version of One Piece), this app
bridges the gap by automatically downloading, organizing, and keeping your One Pace
episodes fully up to date.

## ✨ Features

- **Automated Discovery:** Continuously pulls One Pace's RSS Release feed and
  metadata to detect new episodes.
- **Smart Library Scanning:** Scans your existing Plex library to compare available
  episodes against your local files.
- **Seamless Downloading:** Automatically sends `magnetURI` links to qBittorrent for
  missing episodes.
- **File Verification (Optional):** Hashes existing files to ensure they match the latest
  releases and automatically re-downloads outdated versions.
- **qBittorrent Monitoring:** Tracks download progress. Once completed, it:
  - Copies the file to your designated Plex Library folder.
  - Updates the metadata directly on Plex.
  - Assigns a custom (`completed`) category to the processed torrents in qBittorrent.

## 🚀 Getting Started

### Prerequisites

Before running OnePacerr, ensure you have the following services up and running:

- **Docker & Docker Compose** (or k8s, or custom app in Truenas or equivalent)
- **Plex Media Server**
- **qBittorrent** (with WebUI enabled)

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
      - SKIP_VERIFY_PRESENT_FILES=true
      - SKIP_UPDATE_METADATA_PRESENT_FILES=true
      #- INCLUDE_SPECIALS=false
      - PREFER_EXTENDED=true

      # Metadata Settings
      #-METADATA_URL=raw.githubusercontent.com/ladyisatis/one-pace-metadata/refs/heads/v2metadata/data.json
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
      #- PLEX_CREATE_SHOW_IF_NOT_FOUND=true

    volumes:
      - /mnt/Library/Movies:/mnt/Library/Movies
      - /mnt/Library/Series:/mnt/Library/Series
      - /mnt/Applications/Downloads:/mnt/Applications/Downloads
```

### ⚙️ Environment Variables Explained

Here is a breakdown of key optional variables you can adjust in your
`docker-compose.yml`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `SKIP_VERIFY_PRESENT_FILES` | `false` | If `false`, hashes files present in Plex upon metadata updates to ensure they are the latest/wanted versions. |
| `SKIP_UPDATE_METADATA_PRESENT_FILES` | `false` | If `false`, automatically updates metadata for files already in your Plex library, otherwise only does so for new downloads. |
| `PREFER_EXTENDED` | `false` | Set to `true` to prioritize extended cuts over standard releases. |
| `PLEX_CREATE_SHOW_IF_NOT_FOUND` | `false` | If `false`, the app crashes if "One Pace" isn't already on Plex (useful for catching typos on first setup). Set to `true` to auto-create the show. |
| `MOUNT_*` Variables | _None_ | Use these mapping variables if Plex or qBittorrent use different mount paths than the OnePacerr container. |

## ️ Roadmap

- [ ] **Support alternate torrent clients**
- [ ] **Custom folder/files names**
- [ ] **Poster settings to chose either official/alternate or customs**
- [ ] **Jellyfin Support** _(Requested by Marci)_
- [Request a new feature](https://github.com/eltharynd/OnePacerr/issues)

## 🤝 Credits & Acknowledgements

This project wouldn't be possible without the incredible work of the community:

- **[One Pace](https://onepace.net/en):** The incredible team behind the unofficial fan edits.
- **[Ladyisatis](https://github.com/ladyisatis):** For maintaining the
  [one-pace-metadata](https://github.com/ladyisatis/one-pace-metadata) repository.
- **[/u/piratezekk](https://reddit.com/user/piratezekk):** For the custom poster artwork.

## ❤️ Support

Please **do not** donate to me for this tool.

Instead, please show your support for the team
doing the heavy lifting by backing **[One Pace on Patreon](https://patreon.com/onepace)**.
