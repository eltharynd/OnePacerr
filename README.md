# OnePacerr

## Example docker-compose

```yaml
services:
  onepacerr:
    image: eltharynd/onepacerr:latest
    container_name: onepacerr
    restart: unless-stopped
    environment:
      - TZ=Europe/Zurich
      - PUID=568
      - PGID=568

      #- DEBUGGING=false

      - TORRENT_URL=http://localhost:8080
      - TORRENT_USER=<your-username-here>
      - TORRENT_PASSWORD=<your-password-here>

      #- TORRENT_CATEGORY=onepacerr
      #- TORRENT_CATEGORY_ONCE_COMPLETED=completed
      #- TORRENT_CHECK_INTERVAL=30

      # leave to default(false) to hash files present in plex whenever metadata is updated
      # to make sure they're up to date 
      - SKIP_VERIFY_PRESENT_FILES=true
      # leave to default(false) to update metadata for files already present in plex
      - SKIP_UPDATE_METADATA_PRESENT_FILES=true

      #- INCLUDE_SPECIALS=false
      - PREFER_EXTENDED=true

      #- METADATA_URL=https://raw.githubusercontent.com/ladyisatis/one-pace-metadata/refs/heads/v2/metadata/data.json
      #- METADATA_LANGUAGE=en
      #- METADATA_CHECK_INTERVAL=3600

      # Use these when plex/qbittorrent have different mounts than onepacerr
      #- MOUNT_LIBRARY_PLEX=/mnt/Library/Series
      #- MOUNT_LIBRARY_ONEPACERR=\\TRUENAS\series
      #- MOUNT_DOWNLOADS_QBITTORRENT=/mnt/Applications/Downloads
      #- MOUNT_DOWNLOADS_ONEPACERR=\\TRUENAS\downloads

      - PLEX_URL=http://localhost:32400
      - PLEX_TOKEN=<your-token-here>

      - PLEX_LIBRARY_NAME=TV Shows
      - PLEX_SERIES_NAME=One Pace

      # Set this to false if you want the app to crash if the Show doesn't exist on Plex already
      # Mostly useful on first time setup to make sure you spelled it correctly
      #- PLEX_CREATE_SHOW_IF_NOT_FOUND=true

    volumes:
      - /mnt/Library/Movies:/mnt/Library/Movies
      - /mnt/Library/Series:/mnt/Library/Series
      - /mnt/Application/Downloads:/mnt/Application/Downloads
```

## Credits

- Metadata from [one-pace-metadata](https://github.com/ladyisatis/one-pace-metadata) by [Ladyisatis](https://github.com/ladyisatis)
- Posters by [/u/piratezekk](https://www.reddit.com/user/piratezekk)
