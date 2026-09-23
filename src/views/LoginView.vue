<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const errorMessages: Record<string, string> = {
  cancelled: 'ログインがキャンセルされました。',
  forbidden: 'このアカウントではログインできません。',
  failed: 'ログインに失敗しました。もう一度お試しください。',
}
const error = computed(() => errorMessages[String(route.query.error)])
</script>

<template>
  <main>
    <h1>yoroz</h1>
    <p v-if="error">
      {{ error }}
    </p>
    <!-- A full page load, not a RouterLink: the OAuth flow lives in the Worker -->
    <a href="/auth/google">Google でログイン</a>
  </main>
</template>
