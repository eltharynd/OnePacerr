import { execSync } from 'child_process'

// npm automatically provides the package version to process.env
const version = process.env.npm_package_version

if (!version) {
	console.error(
		'❌ Error: This script must be run via npm (e.g., npm run package)',
	)
	process.exit(1)
}

// Construct your exact Docker command
const command = `docker buildx build --platform linux/amd64,linux/arm64 . -t eltharynd/onepacerr:v${version} -t eltharynd/onepacerr:latest --push`

console.log(
	`🚀 Starting multi-platform Docker build for version v${version}...`,
)

try {
	// Executes the command and inherits the terminal output so you see the progress
	execSync(command, { stdio: 'inherit' })
	console.log('✅ Docker build and push completed successfully!')
} catch (error) {
	console.error('❌ Docker build failed:', error.message)
	process.exit(1)
}
