import chalk from 'chalk'
import JSONLogger from 'node-json-logger'

import environment from '../environment.js'

export default class Logger {
	static readonly jsonlogger =
		environment.LOG_OUTPUT === 'json'
			? new JSONLogger({ loggerName: 'node' })
			: null

	static debug(args: any) {
		if (environment.TESTING) return
		if (environment.DEBUGGING)
			if (Logger.jsonlogger) {
				Logger.jsonlogger.debug(args)
			} else {
				console.debug(
					chalk.green(`[${new Date().toLocaleString()}] [DEBUG] -`),
					typeof args === 'string' ? chalk.greenBright(args) : args,
				)
			}
	}

	static log(args: any) {
		if (environment.TESTING) return
		return Logger.info(args)
	}

	static info(args: any) {
		if (environment.TESTING) return
		if (Logger.jsonlogger) {
			Logger.jsonlogger.info(args)
		} else {
			console.info(
				chalk.blue(`[${new Date().toLocaleString()}] [INFO] -`),
				typeof args === 'string' ? chalk.blueBright(args) : args,
			)
		}
	}

	static warn(args: any) {
		if (environment.TESTING) return
		if (Logger.jsonlogger) {
			if (args?.stack) Logger.jsonlogger.warn(args.stack)
			else Logger.jsonlogger.warn(args)
		} else if (args?.stack) {
			let lines: string[] = args.stack.split('\n')
			console.warn(
				chalk.yellow(`[${new Date().toLocaleString()}] [WARN] -`),
				chalk.yellowBright(`${lines.splice(0, 1)[0]}`),
			)
			for (let line of lines) console.log(chalk.yellowBright(line))
		} else {
			console.warn(
				chalk.yellow(`[${new Date().toLocaleString()}] [WARN] -`),
				typeof args === 'string' ? chalk.yellowBright(args) : args,
			)
		}
	}

	static error(args: any) {
		if (environment.TESTING) return
		if (Logger.jsonlogger) {
			if (args?.stack) Logger.jsonlogger.error(args.stack)
			else Logger.jsonlogger.error(args)
		} else if (args?.stack) {
			let lines: string[] = args.stack.split('\n')
			console.error(
				chalk.red(`[${new Date().toLocaleString()}] [ERROR] -`),
				chalk.redBright(`${lines.splice(0, 1)[0]}`),
			)
			for (let line of lines) console.error(chalk.redBright(line))
		} else
			console.error(
				chalk.red(`[${new Date().toLocaleString()}] [ERROR] -`),
				typeof args === 'string' ? chalk.redBright(args) : args,
			)
	}
}
