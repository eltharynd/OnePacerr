import dotenv from 'dotenv'
dotenv.config({ path: './.env' })

export default {
	LOG_OUTPUT: process.env.LOG_OUTPUT || 'text',
	LOCAL_DEV: /true/i.test(process.env.LOCAL_DEV || 'false'),
	DEBUGGING: /true/i.test(process.env.DEBUGGING || 'false'),
	TESTING:
		/test/i.test(process.env.NODE_ENV) || /true/i.test(process.env.TESTING),

	DOMAIN: process.env.DOMAIN || 'localhost',
	API_BASE: process.env.API_BASE || '/api/v1/',
	PORT: Number.parseInt(process.env.PORT || '3000'),
}
