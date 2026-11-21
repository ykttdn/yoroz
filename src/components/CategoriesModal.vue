<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { until } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'

import { api, isNotFound, ResponseError } from '../api'
import { usePreventCloseWhilePending } from '../composables/usePreventCloseWhilePending'
import type { Category } from '../types'
import CategoryNameForm from './CategoryNameForm.vue'

const emit = defineEmits<{ close: [] }>()

const dialog = useTemplateRef('dialog')

onMounted(() => dialog.value?.showModal())

const categoriesQueryKey = ['finances', 'categories']

// isLoadingError rather than isError, since isError also turns true when fetching the list again fails, and the
// categories already listed and the open row would then be replaced with the error
const {
  data: categories, isPending: isCategoriesPending, isLoadingError: isCategoriesLoadingError,
} = useQuery({
  queryKey: categoriesQueryKey,
  queryFn: async ({ signal }) => {
    const res = await api.finances.categories.$get({}, { init: { signal } })
    if (!res.ok) {
      throw new ResponseError(`/api/finances/categories failed: ${res.status}`, res.status)
    }
    return res.json()
  },
})

const selectedKind = ref<Category['kind']>('expense')
const categoriesOfSelectedKind = computed(() =>
  (categories.value ?? []).filter(category => category.kind === selectedKind.value))

const currentAction = ref<{ action: 'add' } | { action: 'rename' | 'delete', category: Category }>()
const categoryName = ref('')

watch(selectedKind, () => {
  currentAction.value = undefined
})

const addButtonId = 'category-add-button'
const renameButtonId = (category: Category) => `category-${category.id}-rename-button`
const deleteButtonId = (category: Category) => `category-${category.id}-delete-button`
const deleteCancelButtonId = 'category-delete-cancel-button'

// The confirmation replaces the trash button that opened it, so focus would otherwise fall to the body
const vFocus = { mounted: (element: HTMLElement) => element.focus() }

const queryClient = useQueryClient()

const { mutate: addCategory, isPending: isAddPending, error: addError, reset: resetAdd } = useMutation({
  mutationFn: async (json: { name: string, kind: Category['kind'] }) => {
    const res = await api.finances.categories.$post({ json })
    if (!res.ok) {
      throw new ResponseError(`/api/finances/categories failed: ${res.status}`, res.status)
    }
  },
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: categoriesQueryKey })
    categoryName.value = ''
  },
})

const { mutate: renameCategory, isPending: isRenamePending, error: renameError, reset: resetRename } = useMutation({
  mutationFn: async ({ category, newName }: { category: Category, newName: string }) => {
    const res = await api.finances.categories[':id'].$put({
      param: { id: String(category.id) }, json: { name: newName },
    })
    if (!res.ok) {
      throw new ResponseError(`/api/finances/categories failed: ${res.status}`, res.status)
    }
  },
  onSuccess: async (_, { category }) => {
    await queryClient.invalidateQueries({ queryKey: categoriesQueryKey })
    endActionAndFocus(renameButtonId(category))
  },
  onError: async (mutationError) => {
    if (isNotFound(mutationError)) {
      await queryClient.invalidateQueries({ queryKey: categoriesQueryKey })
      focusOnceSettled(addButtonId)
    }
  },
})

const { mutate: deleteCategory, isPending: isDeletePending, error: deleteError, reset: resetDelete } = useMutation({
  mutationFn: async (category: Category) => {
    const res = await api.finances.categories[':id'].$delete({ param: { id: String(category.id) } })
    if (!res.ok) {
      throw new ResponseError(`/api/finances/categories failed: ${res.status}`, res.status)
    }
  },
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: categoriesQueryKey })
    endActionAndFocus(addButtonId)
  },
  onError: () => {
    focusOnceSettled(deleteCancelButtonId)
  },
})

const isRequestPending = computed(() => isAddPending.value || isRenamePending.value || isDeletePending.value)

const preventCloseWhilePending = usePreventCloseWhilePending(isRequestPending)

// Ending an action removes the button that had focus, and a pending request disables every button, so focus would
// otherwise fall to the body. The mutations' callbacks run before isRequestPending turns false, while the target is
// still disabled and cannot take focus, and the target may appear only in the render that follows
const focusOnceSettled = async (id: string) => {
  await until(isRequestPending).toBe(false)
  await nextTick()
  document.getElementById(id)?.focus()
}

const endActionAndFocus = (focusTargetId: string) => {
  currentAction.value = undefined
  focusOnceSettled(focusTargetId)
}

// Prepares the input and the error for the action just started, so that the input of a renamed category starts with
// its current name, and an error doesn't stay shown after its action ends or another action starts
watch(currentAction, () => {
  categoryName.value = currentAction.value?.action === 'rename' ? currentAction.value.category.name : ''
  resetAdd()
  resetRename()
  resetDelete()
})

// Resets the add and rename mutations when categoryName changes, so that an error about the name last submitted
// isn't shown below a different name typed since
watch(categoryName, () => {
  resetAdd()
  resetRename()
})

const errorMessage = computed(() => {
  const error = addError.value ?? renameError.value ?? deleteError.value
  if (!error) {
    return undefined
  }
  if (error instanceof ResponseError && error.status === 409) {
    return '同じ名前のカテゴリがすでにあります。'
  }
  if (isNotFound(error)) {
    return 'このカテゴリはすでに削除されています。'
  }
  if (addError.value) {
    return '追加できませんでした。'
  }
  return renameError.value ? '名前を変更できませんでした。' : '削除できませんでした。'
})
</script>

<template>
  <dialog
    ref="dialog"
    class="modal"
    aria-labelledby="categories-modal-title"
    @cancel="preventCloseWhilePending"
    @close="emit('close')"
  >
    <div class="modal-box flex flex-col gap-4">
      <h2
        id="categories-modal-title"
        class="text-lg font-bold"
      >
        カテゴリ
      </h2>
      <div
        role="radiogroup"
        aria-label="収支"
        class="tabs-box tabs"
      >
        <input
          v-model="selectedKind"
          type="radio"
          name="category-kind"
          value="expense"
          class="tab grow"
          aria-label="支出"
          :disabled="isRequestPending"
        >
        <input
          v-model="selectedKind"
          type="radio"
          name="category-kind"
          value="income"
          class="tab grow"
          aria-label="収入"
          :disabled="isRequestPending"
        >
      </div>
      <span
        v-if="isCategoriesPending"
        role="status"
        aria-label="読み込み中"
        class="loading mx-auto loading-spinner"
      />
      <p
        v-else-if="isCategoriesLoadingError"
        role="alert"
        class="alert alert-soft alert-error"
      >
        カテゴリを読み込めませんでした。
      </p>
      <div
        v-else
        class="flex flex-col gap-2"
      >
        <p
          v-if="categoriesOfSelectedKind.length === 0 && currentAction?.action !== 'add'"
          class="py-2 text-center text-sm text-base-content/60"
        >
          カテゴリはありません。
        </p>
        <ul
          v-else
          class="divide-y divide-base-content/5"
        >
          <li
            v-for="category in categoriesOfSelectedKind"
            :key="category.id"
            class="flex min-h-12 items-center gap-2 py-1"
          >
            <CategoryNameForm
              v-if="currentAction?.action === 'rename' && currentAction.category.id === category.id"
              v-model="categoryName"
              :input-label="`${category.name}の新しい名前`"
              submit-label="保存"
              :is-pending="isRequestPending"
              @submit="renameCategory({ category, newName: categoryName })"
              @cancel="endActionAndFocus(renameButtonId(category))"
            />
            <template v-else-if="currentAction?.action === 'delete' && currentAction.category.id === category.id">
              <span class="min-w-0 grow px-2 wrap-break-word">「{{ category.name }}」を削除しますか？</span>
              <button
                :id="deleteCancelButtonId"
                v-focus
                type="button"
                class="btn btn-ghost btn-sm"
                :disabled="isRequestPending"
                @click="endActionAndFocus(deleteButtonId(category))"
              >
                キャンセル
              </button>
              <button
                type="button"
                class="btn btn-error btn-sm"
                :disabled="isRequestPending"
                @click="deleteCategory(category)"
              >
                <span
                  v-if="isDeletePending"
                  class="loading loading-xs loading-spinner"
                />
                削除
              </button>
            </template>
            <template v-else>
              <span class="min-w-0 grow px-2 wrap-break-word">{{ category.name }}</span>
              <button
                :id="renameButtonId(category)"
                type="button"
                class="btn btn-square btn-ghost btn-sm"
                :aria-label="`${category.name}の名前を変更`"
                :disabled="isRequestPending"
                @click="currentAction = { action: 'rename', category }"
              >
                <svg
                  class="size-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 20h4L18.5 9.5a2.83 2.83 0 0 0-4-4L4 16v4zM13.5 6.5l4 4" />
                </svg>
              </button>
              <button
                :id="deleteButtonId(category)"
                type="button"
                class="btn btn-square btn-ghost btn-sm"
                :aria-label="`${category.name}を削除`"
                :disabled="isRequestPending"
                @click="currentAction = { action: 'delete', category }"
              >
                <svg
                  class="size-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                </svg>
              </button>
            </template>
          </li>
          <li
            v-if="currentAction?.action === 'add'"
            class="py-1"
          >
            <CategoryNameForm
              v-model="categoryName"
              input-label="新しいカテゴリの名前"
              submit-label="追加"
              :is-pending="isRequestPending"
              @submit="addCategory({ name: categoryName, kind: selectedKind })"
              @cancel="endActionAndFocus(addButtonId)"
            />
          </li>
        </ul>
        <button
          v-if="currentAction?.action !== 'add'"
          :id="addButtonId"
          type="button"
          class="btn self-start btn-ghost btn-sm"
          :disabled="isRequestPending"
          @click="currentAction = { action: 'add' }"
        >
          ＋ カテゴリを追加
        </button>
      </div>
      <p
        v-if="errorMessage"
        role="alert"
        class="alert alert-soft alert-error"
      >
        {{ errorMessage }}
      </p>
      <div class="modal-action">
        <button
          type="button"
          class="btn"
          :disabled="isRequestPending"
          @click="dialog?.close()"
        >
          閉じる
        </button>
      </div>
    </div>
  </dialog>
</template>
