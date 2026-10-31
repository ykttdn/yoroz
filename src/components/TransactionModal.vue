<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { onMounted, ref, useTemplateRef } from 'vue'

import { MAX_AMOUNT, MAX_MEMO_LENGTH } from '../../worker/finances/limits'
import { api } from '../api'
import { usePreventCloseWhilePending } from '../composables/usePreventCloseWhilePending'
import { fromDateTimeLocal, MAX_DATE_TIME_LOCAL, MIN_DATE_TIME_LOCAL, toDateTimeLocal } from '../finances/datetime'
import type { Transaction } from '../types'

// Edits the transaction when one is given, and adds a new one otherwise
const { transaction = undefined } = defineProps<{ transaction?: Transaction }>()

const emit = defineEmits<{ close: [] }>()

const dialog = useTemplateRef('dialog')

onMounted(() => dialog.value?.showModal())

const kind = ref<Transaction['kind']>(transaction?.kind ?? 'expense')
const amount = ref<number | ''>(transaction?.amount ?? '')
const occurredAt = ref(toDateTimeLocal(transaction ? new Date(transaction.occurredAt) : new Date()))
const memo = ref(transaction?.memo ?? '')

const queryClient = useQueryClient()

const { mutate, isPending, isError } = useMutation({
  mutationFn: async () => {
    const json = { occurredAt: fromDateTimeLocal(occurredAt.value), kind: kind.value, amount: Number(amount.value), memo: memo.value }
    const res = transaction
      ? await api.finances.transactions[':id'].$put({ param: { id: String(transaction.id) }, json })
      : await api.finances.transactions.$post({ json })
    if (!res.ok) {
      throw new Error(`/api/finances/transactions failed: ${res.status}`)
    }
  },
  // Waits for the list to be fetched again before closing, so that FinancesView doesn't focus a menu button that the fetch
  // then replaces or removes, which would leave focus on the body
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['finances', 'transactions'] })
    dialog.value?.close()
  },
})

const preventCloseWhilePending = usePreventCloseWhilePending(isPending)
</script>

<template>
  <dialog
    ref="dialog"
    class="modal"
    aria-labelledby="transaction-modal-title"
    @cancel="preventCloseWhilePending"
    @close="emit('close')"
  >
    <form
      class="modal-box flex flex-col gap-4"
      @submit.prevent="mutate()"
    >
      <h2
        id="transaction-modal-title"
        class="text-lg font-bold"
      >
        {{ transaction ? '明細を編集' : '明細を追加' }}
      </h2>
      <div class="fieldset">
        <!-- The legend and the buttons aren't items of the outer grid, so they get none of its gap and the padding adds the same space -->
        <fieldset class="pt-1.5">
          <legend class="fieldset-legend">
            収支
          </legend>
          <div class="join">
            <input
              v-model="kind"
              type="radio"
              name="kind"
              value="expense"
              class="btn join-item"
              aria-label="支出"
            >
            <input
              v-model="kind"
              type="radio"
              name="kind"
              value="income"
              class="btn join-item"
              aria-label="収入"
            >
          </div>
        </fieldset>
        <label
          for="transaction-amount"
          class="fieldset-legend"
        >金額（円）</label>
        <input
          id="transaction-amount"
          v-model="amount"
          type="number"
          inputmode="numeric"
          min="1"
          :max="MAX_AMOUNT"
          step="1"
          required
          class="input w-full"
        >
        <label
          for="transaction-occurred-at"
          class="fieldset-legend"
        >日時</label>
        <input
          id="transaction-occurred-at"
          v-model="occurredAt"
          type="datetime-local"
          :min="MIN_DATE_TIME_LOCAL"
          :max="MAX_DATE_TIME_LOCAL"
          required
          class="input w-full"
        >
        <label
          for="transaction-memo"
          class="fieldset-legend"
        >メモ</label>
        <textarea
          id="transaction-memo"
          v-model="memo"
          :maxlength="MAX_MEMO_LENGTH"
          class="textarea w-full"
        />
      </div>
      <p
        v-if="isError"
        role="alert"
        class="alert alert-soft alert-error"
      >
        {{ transaction ? '保存できませんでした。' : '登録できませんでした。' }}
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
          type="submit"
          class="btn btn-primary"
          :disabled="isPending"
        >
          <span
            v-if="isPending"
            class="loading loading-spinner"
          />
          {{ transaction ? '保存' : '登録' }}
        </button>
      </div>
    </form>
  </dialog>
</template>
