import { ref } from 'vue'

import type { User } from './types'

// Kept once fetched, since a session that ends later is reported through sessionExpired rather than by clearing this
export const currentUser = ref<User | null>(null)

export const sessionExpired = ref(false)
