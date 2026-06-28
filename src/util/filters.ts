import { isNumber } from 'class-validator'
import { Logger } from 'ez-ts-logger'
import environment from '../environment.js'

type IFilterInternal = {
	arc: number
	episode: number
}

type IFilter = {
	arc: number | string
	episode?: number | string
}

class FiltersContainer {
	private includes: IFilterInternal[] = []
	private excludes: IFilterInternal[] = []

	constructor() {
		for (let line of environment.PIPELINE_FILTERS_INCLUDE?.replaceAll('-', '')
			.replaceAll(' ', '')
			.split(/[;,]/)) {
			if (!line) continue
			this.includes.push(this.matchFilter(line))
		}

		for (let line of environment.PIPELINE_FILTERS_EXCLUDE?.replaceAll('-', '')
			.replaceAll(' ', '')
			.split(/[;,]/)) {
			if (!line) continue
			this.excludes.push(this.matchFilter(line))
		}
	}

	private matchFilter(line: string): IFilterInternal {
		let match = line.match(/^(?:S(\d{1,2})(?:E(\d{1,2}))?|E(\d{1,2}))$/i)
		if (!match) {
			Logger.error(`Invalid Filter specified: '${line}'`)
			throw new Error(`Invalid Filters`)
		}
		let arc = match[1] ? parseInt(match[1], 10) : null
		let episode =
			match[2] || match[3] ? parseInt(match[2] || match[3], 10) : null

		return { arc, episode }
	}

	public testEpisode(filter: IFilterInternal): boolean {
		let toBeIncluded =
			this.includes.length == 0 ||
			this.includes.find(inc => {
				return (
					(!isNumber(inc.arc) || inc.arc == filter.arc) &&
					(!isNumber(inc.episode) || inc.episode == filter.episode)
				)
			})

		if (!toBeIncluded) return false

		let tobeExcluded =
			this.excludes.length > 0 &&
			this.excludes.find(
				exc =>
					(!isNumber(exc.arc) || exc.arc == filter.arc) &&
					(!isNumber(exc.episode) || exc.episode == filter.episode),
			)

		return !tobeExcluded
	}

	public testSeason(filter: Partial<IFilterInternal>): boolean {
		let toBeIncluded =
			this.includes.length == 0 ||
			this.includes.find(inc => isNumber(inc.arc) && inc.arc == filter.arc)

		if (!toBeIncluded) return false

		let tobeExcluded =
			this.excludes.length > 0 &&
			this.excludes.find(exc => isNumber(exc.arc) && exc.arc == filter.arc)

		return !tobeExcluded
	}
}

const Filters = new FiltersContainer()

export const Filter = (filter: IFilter) => {
	let arc = Number.parseInt(`${filter.arc}`)
	let episode = Number.parseInt(`${filter.episode}`)

	if (isNaN(episode)) {
		return Filters.testSeason({
			arc: arc,
		})
	} else
		return Filters.testEpisode({
			arc: arc,
			episode: episode,
		})
}
