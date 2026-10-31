<script setup lang="ts">
import { skipToken, useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { MAX_YEAR, MIN_YEAR } from '../../worker/finances/datetime'
import { api } from '../api'
import ClampedText from '../components/ClampedText.vue'
import DeleteTransactionModal from '../components/DeleteTransactionModal.vue'
import TransactionModal from '../components/TransactionModal.vue'
import { currentYearMonth, formatDay, formatTime, formatYearMonth, isListableYearMonth, shiftYearMonth } from '../finances/datetime'
import type { Transaction } from '../types'

const route = useRoute()

const isAddingTransaction = ref(false)
const transactionToEdit = ref<Transaction>()
const transactionToDelete = ref<Transaction>()

const menuButtonId = (transaction: Transaction) => `transaction-${transaction.id}-menu-button`

// showModal closes the menu, so the dialog could not give focus back to the menu item it was opened from and would leave
// it on the body. Focusing the menu's button before showModal makes the dialog give focus back to that button instead
const focusMenuButton = (transaction: Transaction) => document.getElementById(menuButtonId(transaction))?.focus()

const yearMonth = computed(() => {
  const { month } = route.query
  if (month === undefined) {
    return currentYearMonth()
  }
  return isListableYearMonth(month) ? month : undefined
})

const linkedYearMonth = (delta: number) => {
  if (yearMonth.value === undefined) {
    return undefined
  }
  const shifted = shiftYearMonth(yearMonth.value, delta)
  return isListableYearMonth(shifted) ? shifted : undefined
}
const previousYearMonth = computed(() => linkedYearMonth(-1))
const nextYearMonth = computed(() => linkedYearMonth(1))

const { data: transactions, isPending, isError } = useQuery(() => {
  const month = yearMonth.value
  return {
    queryKey: ['finances', 'transactions', month],
    queryFn: month === undefined
      ? skipToken
      : async ({ signal }) => {
        const res = await api.finances.transactions.$get({ query: { month } }, { init: { signal } })
        if (!res.ok) {
          throw new Error(`/api/finances/transactions failed: ${res.status}`)
        }
        return res.json()
      },
  }
})

// Each transaction is matched only against the group added last, not every group so far, since the API returns the
// transactions newest first and a day's transactions are always next to each other
const transactionsByDay = computed(() =>
  (transactions.value ?? []).reduce<{ heading: string, transactions: Transaction[] }[]>(
    (groups, transaction) => {
      const heading = formatDay(transaction.occurredAt)
      const lastGroup = groups.at(-1)
      if (lastGroup?.heading === heading) {
        lastGroup.transactions.push(transaction)
      } else {
        groups.push({ heading, transactions: [transaction] })
      }
      return groups
    },
    [],
  ),
)

// The sign tells income from expenses, so the amount doesn't rely on its color alone
const amountFormat = new Intl.NumberFormat('ja-JP', { signDisplay: 'always' })
const formatAmount = ({ kind, amount }: Transaction) => amountFormat.format(kind === 'expense' ? -amount : amount)
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-4 p-4">
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-xl font-bold">
        家計簿
      </h1>
      <button
        type="button"
        class="btn btn-primary"
        @click="isAddingTransaction = true"
      >
        明細を追加
      </button>
    </div>
    <TransactionModal
      v-if="isAddingTransaction"
      @close="isAddingTransaction = false"
    />
    <TransactionModal
      v-if="transactionToEdit"
      :transaction="transactionToEdit"
      @close="transactionToEdit = undefined"
    />
    <DeleteTransactionModal
      v-if="transactionToDelete"
      :transaction="transactionToDelete"
      @close="transactionToDelete = undefined"
    />
    <template v-if="yearMonth === undefined">
      <div
        role="alert"
        class="alert alert-soft alert-error"
      >
        <div>
          <p>表示できない月が指定されています。</p>
          <p>{{ MIN_YEAR }}年1月から{{ MAX_YEAR }}年12月までの月を指定してください。</p>
        </div>
      </div>
      <RouterLink
        :to="{ query: {} }"
        class="mx-auto link"
      >
        今月の明細を見る
      </RouterLink>
    </template>
    <template v-else>
      <div class="flex items-center justify-center gap-2">
        <RouterLink
          v-if="previousYearMonth"
          :to="{ query: { month: previousYearMonth } }"
          class="btn btn-circle btn-ghost"
          aria-label="前の月"
        >
          ‹
        </RouterLink>
        <button
          v-else
          type="button"
          class="btn btn-circle btn-ghost"
          aria-label="前の月"
          disabled
        >
          ‹
        </button>
        <h2 class="w-32 text-center text-lg font-bold">
          {{ formatYearMonth(yearMonth) }}
        </h2>
        <RouterLink
          v-if="nextYearMonth"
          :to="{ query: { month: nextYearMonth } }"
          class="btn btn-circle btn-ghost"
          aria-label="次の月"
        >
          ›
        </RouterLink>
        <button
          v-else
          type="button"
          class="btn btn-circle btn-ghost"
          aria-label="次の月"
          disabled
        >
          ›
        </button>
      </div>
      <span
        v-if="isPending"
        role="status"
        aria-label="読み込み中"
        class="loading mx-auto loading-spinner"
      />
      <p
        v-else-if="isError"
        role="alert"
        class="alert alert-soft alert-error"
      >
        明細を読み込めませんでした。
      </p>
      <p
        v-else-if="transactionsByDay.length === 0"
        class="text-center text-base-content/60"
      >
        この月の明細はありません。
      </p>
      <div
        v-else
        class="text-sm tabular-nums"
      >
        <section
          v-for="group in transactionsByDay"
          :key="group.heading"
        >
          <h3 class="bg-base-200 px-4 py-2 font-bold">
            {{ group.heading }}
          </h3>
          <ul class="divide-y divide-base-content/5">
            <li
              v-for="transaction in group.transactions"
              :key="transaction.id"
              class="flex items-center gap-2 py-3 pr-2 pl-4"
            >
              <div class="flex min-w-0 grow flex-col gap-0.5">
                <ClampedText
                  v-if="transaction.memo"
                  :text="transaction.memo"
                />
                <span class="text-xs text-base-content/60">{{ formatTime(transaction.occurredAt) }}</span>
              </div>
              <span
                class="ml-2 shrink-0 text-base font-bold"
                :class="transaction.kind === 'expense' ? 'text-red-600' : 'text-green-700'"
              >{{ formatAmount(transaction) }}<small class="ml-0.5 text-xs">円</small></span>
              <!-- Without popover, the menu would need its own handling to close on an outside click or on Escape -->
              <button
                :id="menuButtonId(transaction)"
                type="button"
                class="btn btn-square btn-ghost btn-sm"
                :aria-label="`${formatDay(transaction.occurredAt)} ${formatTime(transaction.occurredAt)} ${formatAmount(transaction)}円の操作`"
                :popovertarget="`transaction-${transaction.id}-menu`"
                :style="`anchor-name: --transaction-${transaction.id}-menu`"
              >
                ⋮
              </button>
              <!-- Without the flip, the menu of a row near the bottom of the screen opens below the screen, out of reach -->
              <ul
                :id="`transaction-${transaction.id}-menu`"
                popover
                class="menu dropdown dropdown-end w-32 rounded-box bg-base-100 shadow-sm [position-try-fallbacks:flip-block]"
                :style="`position-anchor: --transaction-${transaction.id}-menu`"
              >
                <li>
                  <button
                    type="button"
                    @click="focusMenuButton(transaction); transactionToEdit = transaction"
                  >
                    編集
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    class="text-error"
                    @click="focusMenuButton(transaction); transactionToDelete = transaction"
                  >
                    削除
                  </button>
                </li>
              </ul>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>
