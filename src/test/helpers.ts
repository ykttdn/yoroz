// happy-dom does not close a dialog on Escape, so whether the events that would close it were prevented is checked instead.
// The keydown starts at the body, where focus goes once the modal's buttons are disabled
export const pressEscape = (dialog: Element) => {
  const keydown = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  const cancel = new Event('cancel', { cancelable: true })
  document.body.dispatchEvent(keydown)
  dialog.dispatchEvent(cancel)
  return { keydownPrevented: keydown.defaultPrevented, cancelPrevented: cancel.defaultPrevented }
}
