<script setup lang="ts">
import { currentUser } from '../auth'
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
</template>
