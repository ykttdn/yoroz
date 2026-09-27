import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import LoginView from './LoginView.vue'

// A bare router instead of the app's keeps the navigation guard and its request to /api/me out of these tests.
// Mounting after the navigation settles, as RouterView does, lets the first render already see the query
const mountLoginViewAt = async (url: string) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/login', component: LoginView }],
  })
  await router.push(url)
  return mount(LoginView, { global: { plugins: [router] } })
}

describe('LoginView', () => {
  it('links to the Google sign-in in the Worker', async () => {
    const wrapper = await mountLoginViewAt('/login')

    expect(wrapper.get('a').attributes('href')).toBe('/auth/google')
  })

  it('explains a cancelled sign-in', async () => {
    const wrapper = await mountLoginViewAt('/login?error=cancelled')

    expect(wrapper.get('p').text()).toBe('ログインがキャンセルされました。')
  })

  it('explains a forbidden account', async () => {
    const wrapper = await mountLoginViewAt('/login?error=forbidden')

    expect(wrapper.get('p').text()).toBe('このアカウントではログインできません。')
  })

  it('explains a failed sign-in', async () => {
    const wrapper = await mountLoginViewAt('/login?error=failed')

    expect(wrapper.get('p').text()).toBe('ログインに失敗しました。もう一度お試しください。')
  })

  it('shows no message without an error', async () => {
    const wrapper = await mountLoginViewAt('/login')

    expect(wrapper.find('p').exists()).toBe(false)
  })

  it('shows no message for an unknown error', async () => {
    const wrapper = await mountLoginViewAt('/login?error=unknown')

    expect(wrapper.find('p').exists()).toBe(false)
  })
})
