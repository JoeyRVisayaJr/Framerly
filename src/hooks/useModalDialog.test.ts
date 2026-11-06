import { fireEvent, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useModalDialog } from './useModalDialog'

describe('useModalDialog', () => {
  it('focuses dialog element on mount when initialFocus is not provided', () => {
    const dialog = document.createElement('div')
    dialog.tabIndex = -1
    document.body.appendChild(dialog)

    const onClose = vi.fn()
    const dialogRef = { current: dialog }

    renderHook(() => useModalDialog({ dialogRef, onClose }))
    expect(document.activeElement).toBe(dialog)

    document.body.removeChild(dialog)
  })

  it('focuses and selects initialFocus element when provided', () => {
    const dialog = document.createElement('div')
    const input = document.createElement('input')
    dialog.appendChild(input)
    document.body.appendChild(dialog)

    const onClose = vi.fn()
    const dialogRef = { current: dialog }
    const initialFocus = { current: input }

    renderHook(() => useModalDialog({ dialogRef, initialFocus, onClose }))
    expect(document.activeElement).toBe(input)

    document.body.removeChild(dialog)
  })

  it('restores focus to previous opener on unmount', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    expect(document.activeElement).toBe(opener)

    const dialog = document.createElement('div')
    dialog.tabIndex = -1
    document.body.appendChild(dialog)

    const onClose = vi.fn()
    const dialogRef = { current: dialog }

    const { unmount } = renderHook(() => useModalDialog({ dialogRef, onClose }))
    expect(document.activeElement).toBe(dialog)

    unmount()
    expect(document.activeElement).toBe(opener)

    document.body.removeChild(opener)
    document.body.removeChild(dialog)
  })

  it('calls onClose when Escape key is pressed', () => {
    const dialog = document.createElement('div')
    document.body.appendChild(dialog)

    const onClose = vi.fn()
    const dialogRef = { current: dialog }

    renderHook(() => useModalDialog({ dialogRef, onClose }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    document.body.removeChild(dialog)
  })

  it('traps Tab key navigation within dialog focusables', () => {
    const dialog = document.createElement('div')
    const btn1 = document.createElement('button')
    const btn2 = document.createElement('button')
    dialog.appendChild(btn1)
    dialog.appendChild(btn2)
    document.body.appendChild(dialog)

    const onClose = vi.fn()
    const dialogRef = { current: dialog }

    const { result } = renderHook(() => useModalDialog({ dialogRef, onClose }))
    const handleKeyDown = result.current

    // Forward Tab from last element wraps to first
    btn2.focus()
    const forwardEvent = {
      key: 'Tab',
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLDivElement>
    handleKeyDown(forwardEvent)
    expect(forwardEvent.preventDefault).toHaveBeenCalled()
    expect(document.activeElement).toBe(btn1)

    // Backward Shift+Tab from first element wraps to last
    btn1.focus()
    const backwardEvent = {
      key: 'Tab',
      shiftKey: true,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLDivElement>
    handleKeyDown(backwardEvent)
    expect(backwardEvent.preventDefault).toHaveBeenCalled()
    expect(document.activeElement).toBe(btn2)

    document.body.removeChild(dialog)
  })
})
