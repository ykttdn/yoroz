<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { onMounted, ref, useTemplateRef, watch } from 'vue'

const props = defineProps<{ text: string }>()

const paragraph = useTemplateRef('paragraph')
const expanded = ref(false)
const clamped = ref(false)

const measure = () => {
  // While expanded, line-clamp-3 is off and the paragraph always fits, so measuring then would set clamped to false and
  // hide the button that collapses the paragraph again
  if (paragraph.value && !expanded.value) {
    // scrollHeight is the height of the whole text, including the lines line-clamp-3 hides, and clientHeight is the height
    // of the box that shows it, so the text is cut off when the former is taller.
    // Both heights are rounded to whole pixels, so with a fractional line height text that fits can still be 1px taller.
    // Text that is really cut off is taller by at least a line
    clamped.value = paragraph.value.scrollHeight > paragraph.value.clientHeight + 1
  }
}

onMounted(measure)
// Narrowing the paragraph can cut off text that fit before, so the paragraph is measured again whenever its size changes
useResizeObserver(paragraph, measure)

watch(() => props.text, measure, { flush: 'post' })
watch(expanded, measure, { flush: 'post' })
</script>

<template>
  <div>
    <p
      ref="paragraph"
      class="wrap-break-word whitespace-pre-line"
      :class="{ 'line-clamp-3': !expanded }"
    >
      {{ text }}
    </p>
    <button
      v-if="clamped"
      type="button"
      class="link text-xs text-base-content/70 link-hover"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{ expanded ? '閉じる' : '続きを読む' }}
    </button>
  </div>
</template>
