import { QueryClient } from '@tanstack/vue-query'

// A function rather than one shared client, so each test can start with an empty cache instead of one filled by an
// earlier test
export const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})
