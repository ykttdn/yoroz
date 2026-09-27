import { cloudflareTest } from '@cloudflare/vitest-plugin'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: {
              bindings: {
                GOOGLE_CLIENT_ID: 'test-client-id',
                GOOGLE_CLIENT_SECRET: 'test-client-secret',
                AUTH_SECRET: 'test-auth-secret',
                ALLOWED_EMAILS: 'alice@example.com, bob@example.com',
              },
            },
          }),
        ],
        test: {
          name: 'worker',
          include: ['worker/**/*.test.ts'],
        },
      },
      {
        plugins: [vue()],
        test: {
          name: 'app',
          include: ['src/**/*.test.ts'],
          environment: 'happy-dom',
        },
      },
    ],
  },
})
