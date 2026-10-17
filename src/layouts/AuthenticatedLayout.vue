<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'

import { fetchUser } from '../auth'
import { currentUser, sessionEnded } from '../session'

// Views that make no API calls would otherwise never notice a session that ended while the tab was in the background
const checkSessionOnTabShown = async () => {
  if (document.visibilityState !== 'visible' || sessionEnded.value) {
    return
  }
  try {
    // null means a 401, which the API client has already reported as an expired session
    const user = await fetchUser()
    if (user) {
      // Signing in again elsewhere refreshes the name and email in the session, so the header follows them here
      currentUser.value = user
    }
  } catch {
    // Without this, a check made offline or answered with an error would be logged as an uncaught error on every tab
    // switch. A failed check says nothing about the session, so ending it here would show the modal whenever the
    // network drops
  }
}

onMounted(() => document.addEventListener('visibilitychange', checkSessionOnTabShown))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', checkSessionOnTabShown))

const sessionEndedDialog = useTemplateRef('sessionEndedDialog')

// showModal() rather than the open attribute, so the page behind can't be used while its requests would fail or act
// as another account
const openSessionEndedDialog = () => {
  const dialog = sessionEndedDialog.value
  if (dialog && !dialog.open) {
    dialog.showModal()
  }
}

watch(sessionEndedDialog, openSessionEndedDialog)

const sessionEndedMessages = {
  switched: {
    title: '別のアカウントでログインされました',
    body: '別のタブで別のアカウントにログインされました。再読み込みしてください。',
  },
  expired: {
    title: 'ログインが必要です',
    body: 'セッションが切れました。もう一度ログインしてください。',
  },
} as const

const reload = () => location.reload()
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
  <!-- Closing the modal would only leave a page whose requests all fail or act as another account. Chrome lets a second
       Escape through despite the cancelled cancel event, so the modal reopens once closed -->
  <dialog
    v-if="sessionEnded"
    ref="sessionEndedDialog"
    class="modal"
    aria-labelledby="session-ended-title"
    @cancel.prevent
    @close="openSessionEndedDialog"
  >
    <div class="modal-box flex flex-col gap-4">
      <h2
        id="session-ended-title"
        class="text-lg font-bold"
      >
        {{ sessionEndedMessages[sessionEnded].title }}
      </h2>
      <p>{{ sessionEndedMessages[sessionEnded].body }}</p>
      <div class="modal-action">
        <button
          v-if="sessionEnded === 'switched'"
          type="button"
          class="btn btn-primary"
          @click="reload"
        >
          再読み込み
        </button>
        <!-- A full page load, not a RouterLink: the OAuth flow lives in the Worker -->
        <a
          v-else
          href="/auth/google"
          class="btn btn-primary"
        >Google でログイン</a>
      </div>
    </div>
  </dialog>
</template>
