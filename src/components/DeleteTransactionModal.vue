<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { onMounted, useTemplateRef } from 'vue'

import { api, isNotFound, ResponseError } from '../api'
import { usePreventCloseWhilePending } from '../composables/usePreventCloseWhilePending'
import { formatDay, formatTime } from '../finances/datetime'
import type { Transaction } from '../types'

const { transaction } = defineProps<{ transaction: Transaction }>()

const emit = defineEmits<{ close: [] }>()

const dialog = useTemplateRef('dialog')

onMounted(() => dialog.value?.showModal())

const queryClient = useQueryClient()

const { mutate, isPending, isError, error } = useMutation({
  mutationFn: async () => {
    const res = await api.finances.transactions[':id'].$delete({ param: { id: String(transaction.id) } })
    if (!res.ok) {
      throw new ResponseError(`/api/finances/transactions failed: ${res.status}`, res.status)
    }
  },
  // Waits for the list to be fetched again before closing, so that FinancesView doesn't focus a menu button that the fetch
  // then removes, which would leave focus on the body
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['finances', 'transactions'] })
    dialog.value?.close()
  },
  // A 404 means the transaction was deleted elsewhere, so the list is fetched again to stop showing it
  onError: (mutationError) => {
    if (isNotFound(mutationError)) {
      queryClient.invalidateQueries({ queryKey: ['finances', 'transactions'] })
    }
  },
})

const preventCloseWhilePending = usePreventCloseWhilePending(isPending)

const amountFormat = new Intl.NumberFormat('ja-JP')
</script>

<template>
  <dialog
    ref="dialog"
    class="modal"
    aria-labelledby="delete-transaction-modal-title"
    @cancel="preventCloseWhilePending"
    @close="emit('close')"
  >
    <div class="modal-box flex flex-col gap-4">
      <h2
        id="delete-transaction-modal-title"
        class="text-lg font-bold"
      >
        明細を削除しますか？
      </h2>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm tabular-nums">
        <dt class="text-base-content/60">
          日時
        </dt>
        <dd>{{ formatDay(transaction.occurredAt) }} {{ formatTime(transaction.occurredAt) }}</dd>
        <dt class="text-base-content/60">
          {{ transaction.kind === 'expense' ? '支出' : '収入' }}
        </dt>
        <dd>{{ amountFormat.format(transaction.amount) }}円</dd>
        <template v-if="transaction.memo">
          <dt class="text-base-content/60">
            メモ
          </dt>
          <dd class="line-clamp-3 wrap-break-word whitespace-pre-line">
            {{ transaction.memo }}
          </dd>
        </template>
      </dl>
      <p
        v-if="isError"
        role="alert"
        class="alert alert-soft alert-error"
      >
        {{ isNotFound(error) ? 'この明細はすでに削除されています。' : '削除できませんでした。' }}
      </p>
      <div class="modal-action justify-between">
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="isPending"
          @click="dialog?.close()"
        >
          キャンセル
        </button>
        <button
          type="button"
          class="btn btn-error"
          :disabled="isPending"
          @click="mutate()"
        >
          <span
            v-if="isPending"
            class="loading loading-spinner"
          />
          削除
        </button>
      </div>
    </div>
  </dialog>
</template>
