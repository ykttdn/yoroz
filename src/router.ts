import { createRouter, createWebHistory } from 'vue-router'

import { fetchUser } from './auth'
import type { User } from './types'
import HomeView from './views/HomeView.vue'
import LoginView from './views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { requiresAuth: true } },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  let user: User | null
  try {
    user = await fetchUser()
  } catch {
    // An aborted navigation would leave a blank page, so send the user to the login screen instead
    user = null
  }
  if (to.meta.requiresAuth && !user) {
    return { name: 'login' }
  }
  if (to.name === 'login' && user) {
    return { name: 'home' }
  }
})

export default router
