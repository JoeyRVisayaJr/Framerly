import { useCallback, useEffect, useRef } from 'react'

interface ModalDialogOptions<T extends HTMLElement> {
  /** The dialog element; focused on mount when `initialFocus` is not given. */
  dialogRef: React.RefObject<T | null>
  /** The element to focus on mount instead of the dialog (e.g. a form input). */
  initialFocus?: React.RefObject<HTMLElement | null>
  /** The element to focus on unmount instead of the captured opener. */
  returnFocusTo?: HTMLElement | null
  /** Called when the user presses Escape. */
  onClose: () => void
}

/**
 * Shared modal dialog behavior: focus the dialog or a target element on
 * mount, trap Tab focus inside the dialog, close on Escape, and restore
 * focus to the opener (or `returnFocusTo`) when the dialog unmounts.
 * Returns the dialog's keydown handler for the Tab trap.
 */
export function useModalDialog<T extends HTMLElement>({
  dialogRef,
  initialFocus,
  returnFocusTo,
  onClose,
}: ModalDialogOptions<T>): (event: React.KeyboardEvent<T>) => void {
  const openerRef = useRef<Element | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    openerRef.current = document.activeElement
    const target = initialFocus?.current ?? dialogRef.current
    target?.focus()
    if (target instanceof HTMLInputElement) target.select()
    return () => {
      const opener =
        returnFocusTo ?? (openerRef.current instanceof HTMLElement ? openerRef.current : null)
      if (opener?.isConnected) opener.focus()
    }
  }, [dialogRef, initialFocus, returnFocusTo])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return useCallback(
    (event: React.KeyboardEvent<T>) => {
      if (event.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [dialogRef],
  )
}
