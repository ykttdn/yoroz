import { ref } from 'vue'

import type { User } from './types'

// Kept once fetched, since a session that ends later is reported through sessionEnded rather than by clearing this
export const currentUser = ref<User | null>(null)

// 'expired' once the Worker rejects the session, 'switched' once another account has signed in elsewhere and the
// page's requests would act as that account
export const sessionEnded = ref<'expired' | 'switched' | null>(null)
