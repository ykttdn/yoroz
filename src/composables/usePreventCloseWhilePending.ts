import { onKeyStroke } from '@vueuse/core'
import type { Ref } from 'vue'

// Closing a modal unmounts it while its request goes on, so the request's result could no longer be shown.
// Returns the handler for the dialog's cancel event. Escape's keydown is prevented as well, since Chrome lets a cancel
// event be prevented only once after each user action. onKeyStroke listens on the window by default. Listening on the
// dialog would miss the keydown, since disabling the modal's buttons moves focus to the body, outside the dialog
export const usePreventCloseWhilePending = (isPending: Readonly<Ref<boolean>>) => {
  const preventCloseWhilePending = (event: Event) => {
    if (isPending.value) {
      event.preventDefault()
    }
  }
  onKeyStroke('Escape', preventCloseWhilePending)
  return preventCloseWhilePending
}
