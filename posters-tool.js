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

/*
<table>

</table>
*/

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
      <img src="../../posters/POSTER_SET/SEASON/poster.png" width="150"><br>
      <sub>ARC_NAME</sub>
    </td>
`

readdir(POSTERS_ROOT).then(subfolders => {
	subfolders.forEach(posterSet => {
		console.log(`Organizing folders for '${posterSet}'`)
		let setFolder = path.join(POSTERS_ROOT, posterSet)

		let previewContents = PREVIEW_HEADER.replace(
			'SHOW',
			'<img src="../../posters/POSTER_SET/poster.png" width="150"><br>',
		).replace('POSTER_SET', `[${posterSet}](../../posters/${posterSet})`)
		if (existsSync(path.join(setFolder, 'poster.png')))
			previewContents = previewContents.replace('POSTER_SET', [posterSet])
		else
			previewContents = previewContents.replace(
				'../../posters/POSTER_SET/poster.png',
				'./missing.png',
			)
		let previewSeasonPaths = {}

		for (let season = 0; season <= CURRENT_SEASONS; season++) {
			let seasonFolder = path.join(setFolder, `${season}`)

			mkdirSync(seasonFolder, {
				recursive: true,
			})

			let files = readdirSync(seasonFolder)
			if (files.length < 1)
				previewSeasonPaths[`Season ${season}`] = TEMPLATE_ITEM.replace(
					'<img src="../../posters/POSTER_SET/SEASON/poster.png" width="150">',
					'<img src="./missing.png" width="150"></img>',
				).replace('ARC_NAME', season == 0 ? 'Specials' : `Season ${season}`)
			for (let file of files) {
				let currentPath = path.join(seasonFolder, file)
				let targetPath = path.join(seasonFolder, 'poster.png')
				//console.log(targetPath)

				if (targetPath != currentPath) {
					console.log(`Renaming '${currentPath}' -> '${targetPath}'`)
					copyFileSync(currentPath, targetPath)
					unlinkSync(currentPath)
				}
				previewSeasonPaths[`Season ${season}`] = TEMPLATE_ITEM.replace(
					'POSTER_SET',
					posterSet,
				)
					.replace('SEASON', season)
					.replace('ARC_NAME', season == 0 ? 'Specials' : `Season ${season}`)
			}
		}

		let files = readdirSync(setFolder, { withFileTypes: true })
			.filter(item => item.isFile())
			.map(item => item.name)
		for (let file of files) {
			let currentPath = path.join(setFolder, file)
			let targetPath = path.join(setFolder, 'poster.png')

			if (targetPath != currentPath) {
				console.log(`Renaming '${currentPath}' -> '${targetPath}'`)
				copyFileSync(currentPath, targetPath)
				unlinkSync(currentPath)
			}
		}

		let keys = Object.keys(previewSeasonPaths)
		let rowsString = ''

		for (let i = 0; i < keys.length; i += 5) {
			let row = keys.slice(i, i + 5)
			let rowString = ''
			for (let item of row) {
				rowString += previewSeasonPaths[item]
			}
			rowsString += TEMPLATE_ROW.replace('ITEMS', rowString)
		}
		let previewPath = `./docs/poster previews/${posterSet}.md`

		previewContents = previewContents.replace('ROWS', rowsString)
		//console.log(previewContents.replace('ROWS', rowsString))
		writeFileSync(previewPath, previewContents)
	})
})
