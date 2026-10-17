import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AdjustmentModal } from './AdjustmentModal'
import type { BatchPicture } from '../lib/batchState'
import type { StoredFrame } from '../lib/frameStore'

/**
 * jsdom does not implement PointerEvent. Dispatch a MouseEvent under the
 * pointer type name instead: React matches listeners by type and reads
 * clientX/clientY, which MouseEvent provides.
 */
function firePointerEvent(
  target: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  init: { clientX: number; clientY: number },
) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
}

const frame: StoredFrame = {
  dataUrl: 'data:image/png;base64,FRAME',
  width: 1080,
  height: 1920,
  aperture: { x: 120, y: 200, width: 840, height: 1260 },
}

const picture: BatchPicture = {
  id: 'p1',
  name: 'a.jpg',
  width: 800,
  height: 600,
  previewUrl: 'data:preview-a',
  status: 'ready',
  adjustment: { panX: 0, panY: 0, zoom: 1, rotation: 0 },
}

function renderModal(overrides: Partial<Parameters<typeof AdjustmentModal>[0]> = {}) {
  const onAdjust = vi.fn()
  const onClose = vi.fn()
  render(
    <AdjustmentModal
      picture={picture}
      cropMode="crop-to-fill"
      onAdjust={onAdjust}
      onClose={onClose}
      {...overrides}
    />,
  )
  return { onAdjust, onClose }
}

describe('AdjustmentModal', () => {
  it('renders the picture preview and the adjustment controls', () => {
    renderModal()
    expect(screen.getByRole('img', { name: /adjusting a\.jpg/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /zoom/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rotate/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const { onClose } = renderModal()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when the close button is clicked', () => {
    const { onClose } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when the backdrop is clicked but not the dialog itself', () => {
    const { onClose } = renderModal()
    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clamps the zoom slider to the 1.0x-3.0x range', () => {
    renderModal()
    const slider = screen.getByRole('slider', { name: /zoom/i })
    expect(slider).toHaveAttribute('min', '1')
    expect(slider).toHaveAttribute('max', '3')
    expect(slider).toHaveAttribute('step', '0.01')
  })

  it('reports a zoom change from the slider', () => {
    const { onAdjust } = renderModal()
    fireEvent.change(screen.getByRole('slider', { name: /zoom/i }), { target: { value: '2.5' } })
    expect(onAdjust).toHaveBeenCalledWith({ zoom: 2.5 })
  })

  it('rotates clockwise by 90 degrees per click', () => {
    const { onAdjust } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: /rotate/i }))
    expect(onAdjust).toHaveBeenCalledWith({ rotation: 90 })
  })

  it('resets to the auto-centered default', () => {
    const { onAdjust } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    expect(onAdjust).toHaveBeenCalledWith({ panX: 0, panY: 0, zoom: 1, rotation: 0 })
  })

  it('pans the picture when dragging the preview', () => {
    const adjusted: BatchPicture = {
      ...picture,
      adjustment: { panX: 0.1, panY: 0, zoom: 1, rotation: 0 },
    }
    const onAdjust = vi.fn()
    render(<AdjustmentModal picture={adjusted} onAdjust={onAdjust} onClose={() => {}} />)

    const preview = screen.getByTestId('adjust-preview')
    vi.spyOn(preview, 'getBoundingClientRect').mockReturnValue({
      width: 300,
      height: 400,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 300,
      bottom: 400,
      toJSON: () => ({}),
    } as DOMRect)
    firePointerEvent(preview, 'pointerdown', { clientX: 150, clientY: 200 })
    firePointerEvent(preview, 'pointermove', { clientX: 180, clientY: 200 })

    // dx = 30/300 = 0.1 on top of the existing 0.1
    expect(onAdjust).toHaveBeenCalledWith({ panX: 0.2, panY: 0 })
  })

  it('pans the preview with the arrow keys without touching zoom or rotation', () => {
    const { onAdjust } = renderModal({ picture: { ...picture, adjustment: { panX: 0.1, panY: 0, zoom: 2, rotation: 0 } } })
    const preview = screen.getByTestId('adjust-preview')
    fireEvent.keyDown(preview, { key: 'ArrowRight' })
    expect(onAdjust).toHaveBeenCalledTimes(1)
    const call = onAdjust.mock.calls[0][0]
    expect(call.panX).toBeCloseTo(0.15, 10)
    expect(call.panY).toBe(0)
    // Only the pan is patched; zoom and rotation stay untouched.
    expect(Object.keys(call).sort()).toEqual(['panX', 'panY'])
  })

  it('pans in larger steps while Shift is held', () => {
    const { onAdjust } = renderModal()
    const preview = screen.getByTestId('adjust-preview')
    fireEvent.keyDown(preview, { key: 'ArrowRight', shiftKey: true })
    expect(onAdjust).toHaveBeenCalledWith({ panX: 0.25, panY: 0 })
  })

  it('does not scroll or report other keys from the pan preview', () => {
    const { onAdjust } = renderModal()
    fireEvent.keyDown(screen.getByTestId('adjust-preview'), { key: 'Enter' })
    expect(onAdjust).not.toHaveBeenCalled()
  })

  it('previews inside the Frame aperture matching the auto-centered fit', () => {
    renderModal({ frame, picture: { ...picture, focalPoint: { x: 0.25, y: 0.75 } } })
    // Aperture 840x1260 inside Frame 1080x1920 -> 77.78% x 65.63%, offset 11.11%/10.42%
    const box = screen.getByTestId('adjust-aperture')
    expect(box.style.width).toContain('77.77')
    expect(box.style.left).toContain('11.11')
    const img = screen.getByRole('img', { name: /adjusting a\.jpg/i })
    // Focal point mapped the same way the Visual Grid card does it
    expect(img.style.objectPosition).toBe('0% 50%')
    expect(img.style.transform).toContain('scale(1)')
  })

  it('composites the active Frame graphic over the preview', () => {
    renderModal({ frame })
    expect(screen.getByRole('img', { name: /active frame/i })).toHaveAttribute('src', frame.dataUrl)
  })

  it('restores focus to the element that opened it when it closes', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    expect(document.activeElement).toBe(opener)

    const { unmount } = render(
      <AdjustmentModal picture={picture} frame={frame} onAdjust={() => {}} onClose={() => {}} />,
    )
    expect(document.activeElement).not.toBe(opener)

    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('traps Tab inside the dialog', () => {
    renderModal({ frame })
    const dialog = screen.getByRole('dialog')
    const closeButton = screen.getByRole('button', { name: /close/i })
    const reset = screen.getByRole('button', { name: /reset/i })
    reset.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    // Tabbing forward from the last control wraps back into the dialog
    expect(dialog.contains(document.activeElement)).toBe(true)
    closeButton.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(dialog.contains(document.activeElement)).toBe(true)
  })
})
