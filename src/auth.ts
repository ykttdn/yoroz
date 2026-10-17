import { api } from './api'
import { currentUser } from './session'
import type { User } from './types'

export const fetchUser = async (): Promise<User | null> => {
  const res = await api.me.$get()
  if (!res.ok && res.status !== 401) {
    throw new Error(`/api/me failed: ${res.status}`)
  }
  return res.ok ? await res.json() : null
}

export const getCachedOrFetchUser = async () => (currentUser.value ??= await fetchUser())
