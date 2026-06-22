import { execSync } from 'child_process'

const version = process.env.npm_package_version

if (!version) {
	console.error(
		'❌ Error: This script must be run via npm (e.g., npm run package)',
	)
	process.exit(1)
}

const GITHUB_USER = 'eltharynd'
const IMAGE = `ghcr.io/${GITHUB_USER}/onepacerr`

console.log(`🔐 Logging in to GHCR...`)
if (!process.env.GITHUB_TOKEN) {
	console.error('❌ Error: GITHUB_TOKEN environment variable is not set.')
	console.error(
		'   Create a PAT at https://github.com/settings/tokens with write:packages scope',
	)
	process.exit(1)
}
execSync(
	`echo ${process.env.GITHUB_TOKEN} | docker login ghcr.io -u ${GITHUB_USER} --password-stdin`,
	{ stdio: 'inherit' },
)

const command = `docker buildx build --platform linux/amd64,linux/arm64 . -t ${IMAGE}:v${version} -t ${IMAGE}:latest --push`

console.log(
	`🚀 Starting multi-platform Docker build for version v${version}...`,
)
try {
	execSync(command, { stdio: 'inherit' })
	console.log('✅ Docker build and push completed successfully!')
} catch (error) {
	console.error('❌ Docker build failed:', error.message)
	process.exit(1)
}
