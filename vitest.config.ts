import { join } from 'node:path'

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const migrations = await readD1Migrations(join(import.meta.dirname, 'migrations'))

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
                // A test-only binding for the migrations, so the setup file can apply them
                TEST_MIGRATIONS: migrations,
              },
            },
          }),
        ],
        test: {
          name: 'worker',
          include: ['worker/**/*.test.ts'],
          setupFiles: ['worker/test/setup.ts'],
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
