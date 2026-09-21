<script setup lang="ts">
import { currentUser } from '../auth'
import HelloWorld from '../components/HelloWorld.vue'
</script>

<template>
  <header v-if="currentUser">
    <span>{{ currentUser.name }} ({{ currentUser.email }})</span>
    <form
      method="post"
      action="/auth/logout"
    >
      <button type="submit">
        ログアウト
      </button>
    </form>
  </header>
  <HelloWorld />
</template>
