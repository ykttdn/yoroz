<script setup lang="ts">
import { computed, ref } from 'vue'

import { api } from '../api'
import { currentYearMonth, formatDay, formatTime, formatYearMonth } from '../finances/datetime'
import type { Transaction } from '../types'

const yearMonth = currentYearMonth()

const transactions = ref<Transaction[]>([])
const error = ref(false)

// Each transaction is matched only against the group added last, not every group so far, since the API returns the
// transactions newest first and a day's transactions are always next to each other
const transactionsByDay = computed(() =>
  transactions.value.reduce<{ heading: string, transactions: Transaction[] }[]>(
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

const load = async () => {
  try {
    const res = await api.finances.transactions.$get({ query: { month: yearMonth } })
    if (!res.ok) {
      throw new Error(`/api/finances/transactions failed: ${res.status}`)
    }
    transactions.value = await res.json()
  } catch {
    error.value = true
  }
}

load()
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-4 p-4">
    <h1 class="text-xl font-bold">
      家計簿
    </h1>
    <h2 class="text-center text-lg font-bold">
      {{ formatYearMonth(yearMonth) }}
    </h2>
    <p
      v-if="error"
      role="alert"
      class="alert alert-soft alert-error"
    >
      明細を読み込めませんでした。
    </p>
    <p
      v-else-if="transactions.length === 0"
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
            class="flex items-center justify-between gap-4 px-4 py-3"
          >
            <div class="flex min-w-0 flex-col gap-0.5">
              <p
                v-if="transaction.memo"
                class="wrap-break-word whitespace-pre-line"
              >
                {{ transaction.memo }}
              </p>
              <span class="text-xs text-base-content/60">{{ formatTime(transaction.occurredAt) }}</span>
            </div>
            <span
              class="shrink-0 text-base font-bold"
              :class="transaction.kind === 'expense' ? 'text-red-600' : 'text-green-700'"
            >{{ formatAmount(transaction) }}<small class="ml-0.5 text-xs">円</small></span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
