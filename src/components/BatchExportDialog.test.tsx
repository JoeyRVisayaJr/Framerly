import { fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { BatchExportDialog } from './BatchExportDialog'

const now = new Date(2026, 9, 20)

function renderDialog(overrides: Partial<React.ComponentProps<typeof BatchExportDialog>> = {}) {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(<BatchExportDialog now={now} onConfirm={onConfirm} onClose={onClose} {...overrides} />)
  return { onConfirm, onClose, input: screen.getByRole('textbox', { name: /archive name/i }) }
}

describe('BatchExportDialog', () => {
  it('pre-fills the dated archive name without the .zip extension', () => {
    const { input } = renderDialog()
    expect(input).toHaveValue('framerly-2026-10-20')
  })

  it('starts the export on Enter with the default JPEG format', () => {
    const { onConfirm, input } = renderDialog()
    fireEvent.change(input, { target: { value: 'event/2026-pictures' } })
    fireEvent.submit(input.closest('form')!)

    expect(onConfirm).toHaveBeenCalledWith('event2026-pictures.zip', 'jpeg')
  })

  it('appends .zip and falls back to the dated name when the field is empty', () => {
    const { onConfirm, input } = renderDialog()
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.submit(input.closest('form')!)
    expect(onConfirm).toHaveBeenLastCalledWith('framerly-2026-10-20.zip', 'jpeg')

    fireEvent.change(input, { target: { value: 'summer-recap' } })
    fireEvent.submit(input.closest('form')!)
    expect(onConfirm).toHaveBeenLastCalledWith('summer-recap.zip', 'jpeg')
  })

  it('exports lossless PNG when selected', () => {
    const { onConfirm, input } = renderDialog()
    fireEvent.click(screen.getByRole('radio', { name: /png/i }))
    expect(screen.getByRole('radio', { name: /png/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /jpeg/i })).not.toBeChecked()

    fireEvent.submit(input.closest('form')!)
    expect(onConfirm).toHaveBeenCalledWith('framerly-2026-10-20.zip', 'png')
  })

  it('closes on Escape without exporting', () => {
    const { onConfirm, onClose } = renderDialog()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('closes on a backdrop click without exporting', () => {
    const { onConfirm, onClose } = renderDialog()
    fireEvent.click(screen.getByTestId('batch-export-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('does not close when clicking inside the dialog', () => {
    const { onClose } = renderDialog()
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('restores focus to the Export button when it closes', () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Export All as ZIP
          </button>
          {open && (
            <BatchExportDialog
              now={now}
              onConfirm={() => setOpen(false)}
              onClose={() => setOpen(false)}
            />
          )}
        </>
      )
    }
    render(<Harness />)
    const opener = screen.getByRole('button', { name: /export all as zip/i })
    opener.focus()
    fireEvent.click(opener)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(opener).toHaveFocus()
  })

  it('restores focus to the supplied Export button even when the click did not focus it', () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      const opener = useRef<HTMLButtonElement>(null)
      return (
        <>
          <button ref={opener} type="button" onClick={() => setOpen(true)}>
            Export All as ZIP
          </button>
          {open && (
            <BatchExportDialog
              now={now}
              returnFocusTo={opener.current}
              onConfirm={() => setOpen(false)}
              onClose={() => setOpen(false)}
            />
          )}
        </>
      )
    }
    render(<Harness />)
    const opener = screen.getByRole('button', { name: /export all as zip/i })
    expect(opener).not.toHaveFocus()
    fireEvent.click(opener)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(opener).toHaveFocus()
  })
})
