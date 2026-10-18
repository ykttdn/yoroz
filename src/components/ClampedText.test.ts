import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, toValue } from 'vue'

import ClampedText from './ClampedText.vue'

// happy-dom doesn't lay out text, so the heights that tell whether the text is cut off are stubbed
const stubHeights = ({ scrollHeight, clientHeight }: { scrollHeight: number, clientHeight: number }) => {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(clientHeight)
}

// happy-dom's ResizeObserver never calls back, so useResizeObserver is replaced to let a test report a resize itself
let observation: { target: unknown, callback: () => void } | undefined
vi.mock('@vueuse/core', () => ({
  useResizeObserver: (target: unknown, callback: () => void) => {
    observation = { target, callback }
  },
}))

describe('ClampedText', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows text that fits without a button', async () => {
    stubHeights({ scrollHeight: 60, clientHeight: 60 })

    const wrapper = mount(ClampedText, { props: { text: 'テストメモ' } })
    await nextTick()

    expect(wrapper.get('p').text()).toBe('テストメモ')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('treats text 1px taller than its box as fitting, as rounding a fractional line height can make it so', async () => {
    stubHeights({ scrollHeight: 61, clientHeight: 60 })

    const wrapper = mount(ClampedText, { props: { text: 'テストメモ' } })
    await nextTick()

    expect(wrapper.find('button').exists()).toBe(false)
  })

  // happy-dom doesn't render line breaks either, so this checks for the style that keeps them instead
  it('keeps the line breaks in the text', async () => {
    stubHeights({ scrollHeight: 60, clientHeight: 60 })

    const wrapper = mount(ClampedText, { props: { text: '1行目\n2行目' } })
    await nextTick()

    expect(wrapper.get('p').classes()).toContain('whitespace-pre-line')
  })

  it('shows the button once narrowing the paragraph cuts off the text', async () => {
    stubHeights({ scrollHeight: 60, clientHeight: 60 })
    const wrapper = mount(ClampedText, { props: { text: 'テストメモ' } })
    await nextTick()

    stubHeights({ scrollHeight: 120, clientHeight: 60 })
    // Calls the function ClampedText passed to useResizeObserver, as the browser would once the paragraph is narrowed
    observation?.callback()
    await nextTick()

    expect(toValue(observation?.target)).toBe(wrapper.get('p').element)
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('expands and collapses text that is cut off', async () => {
    stubHeights({ scrollHeight: 120, clientHeight: 60 })

    const wrapper = mount(ClampedText, { props: { text: '長いメモ' } })
    await nextTick()
    const button = wrapper.get('button')

    expect(wrapper.get('p').classes()).toContain('line-clamp-3')
    expect(button.text()).toBe('続きを読む')
    expect(button.attributes('aria-expanded')).toBe('false')

    await button.trigger('click')

    expect(wrapper.get('p').classes()).not.toContain('line-clamp-3')
    expect(button.text()).toBe('閉じる')
    expect(button.attributes('aria-expanded')).toBe('true')

    await button.trigger('click')

    expect(wrapper.get('p').classes()).toContain('line-clamp-3')
    expect(button.text()).toBe('続きを読む')
  })
})
