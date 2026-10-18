import './style.css'

import { VueQueryPlugin } from '@tanstack/vue-query'
import { createApp } from 'vue'

import App from './App.vue'
import { createQueryClient } from './queryClient'
import router from './router'

createApp(App).use(router).use(VueQueryPlugin, { queryClient: createQueryClient() }).mount('#app')
