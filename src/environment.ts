import dotenv from 'dotenv'
dotenv.config({ path: './.env' })

const decodeKey = (key: string) => {
	if (!key) return null
	if (/BEGIN/g.test(key)) return key
	let decoded = Buffer.from(key, 'base64').toString()
	if (/BEGIN/g.test(decoded)) return decoded
}

export default {
	LOG_OUTPUT: process.env.LOG_OUTPUT || 'text',
	LOCAL_DEV: /true/i.test(process.env.LOCAL_DEV || 'false'),
	DEBUGGING: /true/i.test(process.env.DEBUGGING || 'false'),
	TESTING:
		/test/i.test(process.env.NODE_ENV) || /true/i.test(process.env.TESTING),

	DOMAIN: process.env.DOMAIN || 'localhost',
	API_BASE: process.env.API_BASE || '/api/v1/',
	PORT: Number.parseInt(process.env.PORT || '3000'),

	IGNORE_JWT_EXPIRATION: /true/i.test(
		process.env.IGNORE_JWT_EXPIRATION || 'false',
	),

	AUTO_EXPIRATION_INTERVAL:
		Number.parseInt(process.env.AUTO_EXPIRATION_INTERVAL || '1800') * 1000,

	PRIVATE_KEY: decodeKey(process.env.PRIVATE_KEY),
	PUBLIC_KEY: decodeKey(process.env.PUBLIC_KEY),

	KC_BASE_URL:
		process.env.KC_BASE_URL || 'http://keycloak.iam.svc.cluster.local:8080',
	//process.env.KC_BASE_URL || 'http://127.0.0.1:8080',

	KC_BOOTSTRAP_ADMIN_PASSWORD:
		process.env.KC_BOOTSTRAP_ADMIN_PASSWORD || 'password',
}
