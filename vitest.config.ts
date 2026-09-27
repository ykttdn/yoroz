import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'worker',
          include: ['worker/**/*.test.ts'],
          environment: 'node',
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
