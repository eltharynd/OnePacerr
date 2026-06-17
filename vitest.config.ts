import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
			include: ['src/**/*.ts'],
			exclude: [
				'src/index.ts',
				'src/environment.ts',
				'src/util/context.ts',
				'src/util/logger.ts',
				'src/api/interceptors/default.interceptor.ts',
			],
		},
	},
})
