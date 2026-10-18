<template>
  <div class="flex flex-col items-start gap-4 p-4">
    <h1 class="text-xl font-bold">
      ホーム
    </h1>
    <RouterLink
      :to="{ name: 'finances' }"
      class="link"
    >
      家計簿
    </RouterLink>
  </div>
</template>
