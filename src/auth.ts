import { ref } from 'vue'

import type { User } from './types'

// Refreshed on every navigation, so a session that ended in another tab is noticed on the next one
export const currentUser = ref<User | null>(null)

export const fetchUser = async (): Promise<User | null> => {
  try {
    const res = await fetch('/api/me')
    if (!res.ok && res.status !== 401) {
      throw new Error(`/api/me failed: ${res.status}`)
    }
    currentUser.value = res.ok ? ((await res.json()) as User) : null
  } catch (e) {
    // Never leave a stale user behind, since the guard treats a failure as signed out
    currentUser.value = null
    throw e
  }
  return currentUser.value
}
