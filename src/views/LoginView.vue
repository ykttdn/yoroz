<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const errorMessages = new Map([
  ['cancelled', 'ログインがキャンセルされました。'],
  ['forbidden', 'このアカウントではログインできません。'],
  ['failed', 'ログインに失敗しました。もう一度お試しください。'],
])
const error = computed(() => errorMessages.get(String(route.query.error)))
</script>

<template>
  <main class="flex min-h-svh items-center justify-center p-4">
    <div class="flex w-full max-w-sm flex-col items-center gap-4">
      <h1 class="text-3xl font-bold">
        yoroz
      </h1>
      <p
        v-if="error"
        role="alert"
        class="alert alert-soft alert-error"
      >
        {{ error }}
      </p>
      <!-- A full page load, not a RouterLink: the OAuth flow lives in the Worker -->
      <a
        href="/auth/google"
        class="btn btn-primary"
      >Google でログイン</a>
    </div>
  </main>
</template>
