import { VueQueryPlugin } from '@tanstack/vue-query'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MAX_CATEGORY_NAME_LENGTH } from '../../worker/finances/limits'
import { createQueryClient } from '../queryClient'
import { getButtonByText, pressEscape } from '../test/helpers'
import type { Category } from '../types'
import CategoriesModal from './CategoriesModal.vue'

const expenseCategory1: Category = { id: 1, name: 'テスト支出カテゴリ1', kind: 'expense' }
const incomeCategory: Category = { id: 2, name: 'テスト収入カテゴリ', kind: 'income' }
const expenseCategory2: Category = { id: 3, name: 'テスト支出カテゴリ2', kind: 'expense' }
const listedCategories = [expenseCategory1, incomeCategory, expenseCategory2]

const duplicateNameResponse = () => Response.json({ error: 'Test duplicate error' }, { status: 409 })

// The first response is the list fetched on mount, and the rest answer the requests that follow in order
const stubResponses = (...responses: Response[]) => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  for (const response of responses) {
    fetchSpy.mockResolvedValueOnce(response)
  }
  return fetchSpy
}

const mountCategoriesModal = async () => {
  const wrapper = mount(CategoriesModal, {
    attachTo: document.body,
    global: { plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]] },
  })
  await flushPromises()
  return wrapper
}

const listedNames = (wrapper: Awaited<ReturnType<typeof mountCategoriesModal>>) =>
  wrapper.findAll('li > span').map(name => name.text())

enableAutoUnmount(afterEach)

describe('CategoriesModal', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists the expense categories first and the income categories once the income tab is chosen', async () => {
    stubResponses(Response.json(listedCategories))
    const wrapper = await mountCategoriesModal()

    expect(listedNames(wrapper)).toEqual(['テスト支出カテゴリ1', 'テスト支出カテゴリ2'])

    await wrapper.get('input[value="income"]').setValue()

    expect(listedNames(wrapper)).toEqual(['テスト収入カテゴリ'])
  })

  it('says the categories could not be loaded, rather than that there are none, when fetching them fails', async () => {
    stubResponses(new Response(null, { status: 500 }))
    const wrapper = await mountCategoriesModal()

    expect(wrapper.get('[role="alert"]').text()).toBe('カテゴリを読み込めませんでした。')
    expect(wrapper.text()).not.toContain('カテゴリはありません。')
    expect(wrapper.text()).not.toContain('＋ カテゴリを追加')
  })

  it('keeps listing the categories and the open input when fetching them again fails', async () => {
    const fetchSpy = stubResponses(
      Response.json(listedCategories),
      Response.json({ id: 4, name: 'テスト追加カテゴリ', kind: 'expense' }, { status: 201 }),
      new Response(null, { status: 500 }),
    )
    const wrapper = await mountCategoriesModal()

    await getButtonByText(wrapper, '＋ カテゴリを追加').trigger('click')
    await wrapper.get('[aria-label="新しいカテゴリの名前"]').setValue('テスト追加カテゴリ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(listedNames(wrapper)).toEqual(['テスト支出カテゴリ1', 'テスト支出カテゴリ2'])
    expect(wrapper.find('[aria-label="新しいカテゴリの名前"]').exists()).toBe(true)
  })

  describe('adding a category', () => {
    it('shows an input below the list once the add button is pressed', async () => {
      stubResponses(Response.json(listedCategories))
      const wrapper = await mountCategoriesModal()

      await getButtonByText(wrapper, '＋ カテゴリを追加').trigger('click')

      expect(wrapper.findAll('li').at(-1)?.find('[aria-label="新しいカテゴリの名前"]').exists()).toBe(true)
    })

    it('marks a name longer than the limit invalid', async () => {
      stubResponses(Response.json(listedCategories))
      const wrapper = await mountCategoriesModal()

      await getButtonByText(wrapper, '＋ カテゴリを追加').trigger('click')
      await wrapper.get('[aria-label="新しいカテゴリの名前"]').setValue('x'.repeat(MAX_CATEGORY_NAME_LENGTH + 1))

      expect(wrapper.get<HTMLInputElement>('[aria-label="新しいカテゴリの名前"]').element.validationMessage)
        .toBe(`${MAX_CATEGORY_NAME_LENGTH}文字以内で入力してください`)
    })

    it('posts the name with the kind of the chosen tab, then empties the input and keeps it open', async () => {
      const addedCategory: Category = { id: 4, name: 'テスト追加カテゴリ', kind: 'income' }
      const fetchSpy = stubResponses(
        Response.json(listedCategories),
        Response.json(addedCategory, { status: 201 }),
        Response.json([...listedCategories, addedCategory]),
      )
      const wrapper = await mountCategoriesModal()

      await wrapper.get('input[value="income"]').setValue()
      await getButtonByText(wrapper, '＋ カテゴリを追加').trigger('click')
      await wrapper.get('[aria-label="新しいカテゴリの名前"]').setValue('テスト追加カテゴリ')
      await wrapper.get('form').trigger('submit')
      await flushPromises()

      const [url, init] = fetchSpy.mock.calls[1]
      expect(String(url)).toMatch(/\/api\/finances\/categories$/)
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toEqual({ name: 'テスト追加カテゴリ', kind: 'income' })
      expect(listedNames(wrapper)).toEqual(['テスト収入カテゴリ', 'テスト追加カテゴリ'])
      expect(wrapper.get<HTMLInputElement>('[aria-label="新しいカテゴリの名前"]').element.value).toBe('')
    })

    it('keeps the name in the input and says so when a category with the name already exists', async () => {
      stubResponses(Response.json(listedCategories), duplicateNameResponse())
      const wrapper = await mountCategoriesModal()

      await getButtonByText(wrapper, '＋ カテゴリを追加').trigger('click')
      await wrapper.get('[aria-label="新しいカテゴリの名前"]').setValue('テスト支出カテゴリ1')
      await wrapper.get('form').trigger('submit')
      await flushPromises()

      expect(wrapper.get('[role="alert"]').text()).toBe('同じ名前のカテゴリがすでにあります。')
      expect(wrapper.get<HTMLInputElement>('[aria-label="新しいカテゴリの名前"]').element.value)
        .toBe('テスト支出カテゴリ1')
    })

    it('hides the error once the name is edited after adding failed', async () => {
      stubResponses(Response.json(listedCategories), duplicateNameResponse())
      const wrapper = await mountCategoriesModal()

      await getButtonByText(wrapper, '＋ カテゴリを追加').trigger('click')
      await wrapper.get('[aria-label="新しいカテゴリの名前"]').setValue('テスト支出カテゴリ1')
      await wrapper.get('form').trigger('submit')
      await flushPromises()
      await wrapper.get('[aria-label="新しいカテゴリの名前"]').setValue('テスト追加カテゴリ')

      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    })

    it('shows an error when the category cannot be added', async () => {
      stubResponses(Response.json(listedCategories), new Response(null, { status: 500 }))
      const wrapper = await mountCategoriesModal()

      await getButtonByText(wrapper, '＋ カテゴリを追加').trigger('click')
      await wrapper.get('[aria-label="新しいカテゴリの名前"]').setValue('テスト追加カテゴリ')
      await wrapper.get('form').trigger('submit')
      await flushPromises()

      expect(wrapper.get('[role="alert"]').text()).toBe('追加できませんでした。')
    })

    it('hides the input and focuses the add button once adding is cancelled', async () => {
      stubResponses(Response.json(listedCategories))
      const wrapper = await mountCategoriesModal()

      await getButtonByText(wrapper, '＋ カテゴリを追加').trigger('click')
      await wrapper.get('[aria-label="キャンセル"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[aria-label="新しいカテゴリの名前"]').exists()).toBe(false)
      expect(document.activeElement).toBe(getButtonByText(wrapper, '＋ カテゴリを追加').element)
    })
  })

  describe('renaming a category', () => {
    it('turns the row into an input holding the current name once its pen button is pressed', async () => {
      stubResponses(Response.json(listedCategories))
      const wrapper = await mountCategoriesModal()

      await wrapper.get('[aria-label="テスト支出カテゴリ1の名前を変更"]').trigger('click')

      expect(wrapper.get<HTMLInputElement>('[aria-label="テスト支出カテゴリ1の新しい名前"]').element.value)
        .toBe('テスト支出カテゴリ1')
    })

    it('puts the new name, then lists the renamed category in place of the input and focuses its pen', async () => {
      const renamedCategory: Category = { ...expenseCategory1, name: 'テスト変更後カテゴリ' }
      const fetchSpy = stubResponses(
        Response.json(listedCategories),
        Response.json(renamedCategory),
        Response.json([renamedCategory, incomeCategory, expenseCategory2]),
      )
      const wrapper = await mountCategoriesModal()

      await wrapper.get('[aria-label="テスト支出カテゴリ1の名前を変更"]').trigger('click')
      await wrapper.get('[aria-label="テスト支出カテゴリ1の新しい名前"]').setValue('テスト変更後カテゴリ')
      await wrapper.get('form').trigger('submit')
      await flushPromises()

      const [url, init] = fetchSpy.mock.calls[1]
      expect(String(url)).toMatch(/\/api\/finances\/categories\/1$/)
      expect(init?.method).toBe('PUT')
      expect(JSON.parse(String(init?.body))).toEqual({ name: 'テスト変更後カテゴリ' })
      expect(wrapper.find('input[type="text"]').exists()).toBe(false)
      expect(listedNames(wrapper)).toEqual(['テスト変更後カテゴリ', 'テスト支出カテゴリ2'])
      expect(document.activeElement).toBe(wrapper.get('[aria-label="テスト変更後カテゴリの名前を変更"]').element)
    })

    it('keeps the input open and says so when a category with the new name already exists', async () => {
      stubResponses(Response.json(listedCategories), duplicateNameResponse())
      const wrapper = await mountCategoriesModal()

      await wrapper.get('[aria-label="テスト支出カテゴリ1の名前を変更"]').trigger('click')
      await wrapper.get('[aria-label="テスト支出カテゴリ1の新しい名前"]').setValue('テスト支出カテゴリ2')
      await wrapper.get('form').trigger('submit')
      await flushPromises()

      expect(wrapper.get('[role="alert"]').text()).toBe('同じ名前のカテゴリがすでにあります。')
      expect(wrapper.find('[aria-label="テスト支出カテゴリ1の新しい名前"]').exists()).toBe(true)
    })

    it('hides the error once the name is edited after renaming failed', async () => {
      stubResponses(Response.json(listedCategories), duplicateNameResponse())
      const wrapper = await mountCategoriesModal()

      await wrapper.get('[aria-label="テスト支出カテゴリ1の名前を変更"]').trigger('click')
      await wrapper.get('[aria-label="テスト支出カテゴリ1の新しい名前"]').setValue('テスト支出カテゴリ2')
      await wrapper.get('form').trigger('submit')
      await flushPromises()
      await wrapper.get('[aria-label="テスト支出カテゴリ1の新しい名前"]').setValue('テスト変更後カテゴリ')

      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    })

    it('says so, stops listing the category and focuses the add button when it was already deleted', async () => {
      stubResponses(
        Response.json(listedCategories),
        new Response(null, { status: 404 }),
        Response.json([incomeCategory, expenseCategory2]),
      )
      const wrapper = await mountCategoriesModal()

      await wrapper.get('[aria-label="テスト支出カテゴリ1の名前を変更"]').trigger('click')
      await wrapper.get('form').trigger('submit')
      await flushPromises()

      expect(wrapper.get('[role="alert"]').text()).toBe('このカテゴリはすでに削除されています。')
      expect(listedNames(wrapper)).toEqual(['テスト支出カテゴリ2'])
      expect(document.activeElement).toBe(getButtonByText(wrapper, '＋ カテゴリを追加').element)
    })

    it('shows an error when the category cannot be renamed', async () => {
      stubResponses(Response.json(listedCategories), new Response(null, { status: 500 }))
      const wrapper = await mountCategoriesModal()

      await wrapper.get('[aria-label="テスト支出カテゴリ1の名前を変更"]').trigger('click')
      await wrapper.get('form').trigger('submit')
      await flushPromises()

      expect(wrapper.get('[role="alert"]').text()).toBe('名前を変更できませんでした。')
    })

    it('puts the row back and focuses its pen button once renaming is cancelled', async () => {
      const fetchSpy = stubResponses(Response.json(listedCategories))
      const wrapper = await mountCategoriesModal()

      await wrapper.get('[aria-label="テスト支出カテゴリ1の名前を変更"]').trigger('click')
      await wrapper.get('[aria-label="キャンセル"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('input[type="text"]').exists()).toBe(false)
      expect(document.activeElement).toBe(wrapper.get('[aria-label="テスト支出カテゴリ1の名前を変更"]').element)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('deleting a category', () => {
    it('asks for confirmation in the row with its cancel button focused, without deleting yet', async () => {
      const fetchSpy = stubResponses(Response.json(listedCategories))
      const wrapper = await mountCategoriesModal()

      await wrapper.get('[aria-label="テスト支出カテゴリ1を削除"]').trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('「テスト支出カテゴリ1」を削除しますか？')
      expect(document.activeElement).toBe(getButtonByText(wrapper, 'キャンセル').element)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('deletes the category once confirmed, stops listing it and focuses the add button', async () => {
      const fetchSpy = stubResponses(
        Response.json(listedCategories),
        new Response(null, { status: 204 }),
        Response.json([incomeCategory, expenseCategory2]),
      )
      const wrapper = await mountCategoriesModal()

      await wrapper.get('[aria-label="テスト支出カテゴリ1を削除"]').trigger('click')
      await getButtonByText(wrapper, '削除').trigger('click')
      await flushPromises()

      const [url, init] = fetchSpy.mock.calls[1]
      expect(String(url)).toMatch(/\/api\/finances\/categories\/1$/)
      expect(init?.method).toBe('DELETE')
      expect(listedNames(wrapper)).toEqual(['テスト支出カテゴリ2'])
      expect(document.activeElement).toBe(getButtonByText(wrapper, '＋ カテゴリを追加').element)
    })

    it('keeps the confirmation with its cancel button focused when the category cannot be deleted', async () => {
      stubResponses(Response.json(listedCategories), new Response(null, { status: 500 }))
      const wrapper = await mountCategoriesModal()

      await wrapper.get('[aria-label="テスト支出カテゴリ1を削除"]').trigger('click')
      await getButtonByText(wrapper, '削除').trigger('click')
      await flushPromises()

      expect(wrapper.get('[role="alert"]').text()).toBe('削除できませんでした。')
      expect(wrapper.text()).toContain('「テスト支出カテゴリ1」を削除しますか？')
      expect(document.activeElement).toBe(getButtonByText(wrapper, 'キャンセル').element)
    })

    it('puts the row back without deleting and focuses its trash button once confirmation is cancelled', async () => {
      const fetchSpy = stubResponses(Response.json(listedCategories))
      const wrapper = await mountCategoriesModal()

      await wrapper.get('[aria-label="テスト支出カテゴリ1を削除"]').trigger('click')
      await getButtonByText(wrapper, 'キャンセル').trigger('click')
      await flushPromises()

      expect(wrapper.text()).not.toContain('を削除しますか？')
      expect(document.activeElement).toBe(wrapper.get('[aria-label="テスト支出カテゴリ1を削除"]').element)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
  })

  it('stops showing an error once its row is closed', async () => {
    stubResponses(Response.json(listedCategories), new Response(null, { status: 500 }))
    const wrapper = await mountCategoriesModal()

    await wrapper.get('[aria-label="テスト支出カテゴリ1を削除"]').trigger('click')
    await getButtonByText(wrapper, '削除').trigger('click')
    await flushPromises()
    await getButtonByText(wrapper, 'キャンセル').trigger('click')

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('closes the open row when another tab is chosen', async () => {
    stubResponses(Response.json(listedCategories))
    const wrapper = await mountCategoriesModal()

    await getButtonByText(wrapper, '＋ カテゴリを追加').trigger('click')
    await wrapper.get('input[value="income"]').setValue()

    expect(wrapper.find('[aria-label="新しいカテゴリの名前"]').exists()).toBe(false)
  })

  it('keeps Escape from closing the modal while a request is pending', async () => {
    stubResponses(Response.json(listedCategories)).mockImplementationOnce(() => new Promise(() => {}))
    const wrapper = await mountCategoriesModal()

    await wrapper.get('[aria-label="テスト支出カテゴリ1を削除"]').trigger('click')
    await getButtonByText(wrapper, '削除').trigger('click')
    await flushPromises()

    expect(pressEscape(wrapper.get('dialog').element)).toEqual({ keydownPrevented: true, cancelPrevented: true })
  })

  it('closes when the close button is pressed', async () => {
    stubResponses(Response.json(listedCategories))
    const wrapper = await mountCategoriesModal()

    await getButtonByText(wrapper, '閉じる').trigger('click')

    expect(wrapper.get<HTMLDialogElement>('dialog').element.open).toBe(false)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
