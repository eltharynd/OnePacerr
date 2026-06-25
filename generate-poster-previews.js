import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readSync,
	unlinkSync,
	writeFileSync,
} from 'fs'
import { readdir } from 'fs/promises'
import path from 'path'

const POSTERS_ROOT = './posters'
const CURRENT_SEASONS = 36

const PREVIEW_HEADER = `# Poster previews for POSTER_SET

## Show

SHOW

## Seasons

<table>
ROWS</table>
`

const TEMPLATE_ROW = `  <tr>
ITEMS  </tr>
`
const TEMPLATE_ITEM = `    <td align="center">
      <img alt="ALT_TEXT" src="../../posters/POSTER_SET/SeasonSEASON.png" width="150"><br>
      <sub>ARC_NAME</sub>
    </td>
`

readdir(POSTERS_ROOT).then(subfolders => {
	subfolders.forEach(posterSet => {
		let setFolder = path.join(POSTERS_ROOT, posterSet)

		let previewContents = PREVIEW_HEADER.replace(
			'SHOW',
			'<img alt="ALT_TEXT" src="../../posters/POSTER_SET/poster.png" width="150"><br>',
		)
			.replace('POSTER_SET', `[${posterSet}](../../posters/${posterSet})`)
			.replace('ALT_TEXT', `Show Poster`)

		if (existsSync(path.join(setFolder, 'poster.png')))
			previewContents = previewContents.replace('POSTER_SET', [posterSet])
		else
			previewContents = previewContents.replace(
				'../../posters/POSTER_SET/poster.png',
				'./missing.png',
			)
		let previewSeasonFiles = {}

		for (let season = 0; season <= CURRENT_SEASONS; season++) {
			let seasonFile = path.resolve(
				setFolder,
				`Season${String(season).padStart(2, '0')}.png`,
			)
			if (!existsSync(seasonFile)) {
				previewSeasonFiles[`Season ${season}`] = TEMPLATE_ITEM.replace(
					`<img alt="ALT_TEXT" src="../../posters/POSTER_SET/SeasonSEASON.png" width="150">`,
					`<img alt="Missing poster for ${season == 0 ? 'Specials' : `Season ${String(season).padStart(2, '0')}`}" src="./missing.png" width="150"></img>`,
				).replace('ARC_NAME', season == 0 ? 'Specials' : `Season ${season}`)
			} else {
				previewSeasonFiles[`Season ${season}`] = TEMPLATE_ITEM.replace(
					'POSTER_SET',
					posterSet,
				)
					.replace(
						'ALT_TEXT',
						`Poster for Season ${season == 0 ? 'Specials' : `${String(season).padStart(2, '0')}`}`,
					)
					.replace('SEASON', String(season).padStart(2, '0'))
					.replace('ARC_NAME', season == 0 ? 'Specials' : `Season ${season}`)
			}
		}

		let keys = Object.keys(previewSeasonFiles)
		let rowsString = ''

		for (let i = 0; i < keys.length; i += 5) {
			let row = keys.slice(i, i + 5)
			let rowString = ''
			for (let item of row) {
				rowString += previewSeasonFiles[item]
			}
			rowsString += TEMPLATE_ROW.replace('ITEMS', rowString)
		}
		let previewPath = `./docs/poster previews/${posterSet}.md`

		previewContents = previewContents.replace('ROWS', rowsString)
		writeFileSync(previewPath, previewContents)
	})
})
