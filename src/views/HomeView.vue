<template>
  <div class="flex flex-col items-start gap-4 p-4">
    <h1 class="text-xl font-bold">
      ホーム
    </h1>
    <ul class="menu w-full max-w-sm rounded-box bg-base-200">
      <li>
        <RouterLink
          :to="{ name: 'finances' }"
          class="justify-between"
        >
          家計簿
          <span aria-hidden="true">›</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
