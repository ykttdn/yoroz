<script setup lang="ts">
import { onMounted, useTemplateRef, watch } from 'vue'

import { MAX_CATEGORY_NAME_LENGTH } from '../../worker/finances/limits'

const { inputLabel, submitLabel, isPending } = defineProps<{
  inputLabel: string
  submitLabel: string
  isPending: boolean
}>()

const name = defineModel<string>({ required: true })

const emit = defineEmits<{ submit: [], cancel: [] }>()

const input = useTemplateRef('input')

onMounted(() => input.value?.focus())

watch(name, () => {
  input.value?.setCustomValidity(
    name.value.length > MAX_CATEGORY_NAME_LENGTH ? `${MAX_CATEGORY_NAME_LENGTH}文字以内で入力してください` : '',
  )
})
</script>

<template>
  <form
    class="flex grow items-center gap-2"
    @submit.prevent="emit('submit')"
  >
    <input
      ref="input"
      v-model="name"
      type="text"
      required
      pattern=".*\S.*"
      title="空白以外の文字を入力してください"
      :readonly="isPending"
      :aria-label="inputLabel"
      class="input min-w-0 grow px-[calc(--spacing(2)-var(--border))] text-base input-sm"
    >
    <button
      type="button"
      class="btn btn-square btn-ghost btn-sm"
      aria-label="キャンセル"
      :disabled="isPending"
      @click="emit('cancel')"
    >
      <svg
        class="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
    <button
      type="submit"
      class="btn btn-square btn-primary btn-sm"
      :aria-label="submitLabel"
      :disabled="isPending"
    >
      <span
        v-if="isPending"
        class="loading loading-xs loading-spinner"
      />
      <svg
        v-else
        class="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12.5l4.5 4.5L19 7" />
      </svg>
    </button>
  </form>
</template>
