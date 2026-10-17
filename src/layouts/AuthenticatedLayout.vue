<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'

import { api } from '../api'
import { currentUser, sessionExpired } from '../session'

// Views that make no API calls would otherwise never notice a session that ended while the tab was in the background
const checkSessionOnTabShown = () => {
  if (document.visibilityState === 'visible' && !sessionExpired.value) {
    // fetchUser() would treat a network failure as signed out, so only the API client's 401 handling should act here
    api.me.$get().catch(() => {})
  }
}

onMounted(() => document.addEventListener('visibilitychange', checkSessionOnTabShown))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', checkSessionOnTabShown))

const sessionExpiredDialog = useTemplateRef('sessionExpiredDialog')

// showModal() rather than the open attribute, so the page behind can't be used while every request would fail
const openSessionExpiredDialog = () => {
  const dialog = sessionExpiredDialog.value
  if (dialog && !dialog.open) {
    dialog.showModal()
  }
}

watch(sessionExpiredDialog, openSessionExpiredDialog)
</script>

<template>
  <header
    v-if="currentUser"
    class="navbar bg-base-200 px-4"
  >
    <span class="flex-1 font-bold">yoroz</span>
    <button
      type="button"
      class="btn btn-circle btn-ghost [anchor-name:--user-menu]"
      popovertarget="user-menu"
      aria-label="ユーザーメニュー"
    >
      <svg
        class="size-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="8"
          r="4"
        />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    </button>
    <ul
      id="user-menu"
      popover
      class="menu dropdown dropdown-end w-52 rounded-box bg-base-100 shadow-sm [position-anchor:--user-menu]"
    >
      <li class="menu-title text-base-content">
        {{ currentUser.name || currentUser.email }}
      </li>
      <li>
        <!-- menu styles only an item's direct child, so the button is that child and reaches the form outside via the form attribute -->
        <button
          type="submit"
          form="logout-form"
        >
          ログアウト
        </button>
      </li>
    </ul>
    <form
      id="logout-form"
      method="post"
      action="/auth/logout"
    />
  </header>
  <main>
    <RouterView />
  </main>
  <!-- Closing the modal would only leave a page whose requests all fail. Chrome lets a second Escape through despite
       the cancelled cancel event, so the modal reopens once closed -->
  <dialog
    v-if="sessionExpired"
    ref="sessionExpiredDialog"
    class="modal"
    aria-labelledby="session-expired-title"
    @cancel.prevent
    @close="openSessionExpiredDialog"
  >
    <div class="modal-box flex flex-col gap-4">
      <h2
        id="session-expired-title"
        class="text-lg font-bold"
      >
        ログインが必要です
      </h2>
      <p>セッションが切れました。もう一度ログインしてください。</p>
      <div class="modal-action">
        <!-- A full page load, not a RouterLink: the OAuth flow lives in the Worker -->
        <a
          href="/auth/google"
          class="btn btn-primary"
        >Google でログイン</a>
      </div>
    </div>
  </dialog>
</template>
