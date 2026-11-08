import type { DOMWrapper } from '@vue/test-utils'

// happy-dom does not close a dialog on Escape, so whether the events that would close it were prevented is checked
// instead. The keydown starts at the body, where focus goes once the modal's buttons are disabled
export const pressEscape = (dialog: Element) => {
  const keydown = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  const cancel = new Event('cancel', { cancelable: true })
  document.body.dispatchEvent(keydown)
  dialog.dispatchEvent(cancel)
  return { keydownPrevented: keydown.defaultPrevented, cancelPrevented: cancel.defaultPrevented }
}

export const getButtonByText = (wrapper: Pick<DOMWrapper<Element>, 'findAll'>, text: string) => {
  const button = wrapper.findAll('button').find(candidate => candidate.text() === text)
  if (!button) {
    throw new Error(`No button with text: ${text}`)
  }
  return button
}
