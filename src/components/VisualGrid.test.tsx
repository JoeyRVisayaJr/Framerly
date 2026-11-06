import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VisualGrid } from './VisualGrid'
import type { StoredFrame } from '../lib/storage'
import type { Adjustment } from '../lib/framing'
import type { BatchPicture } from '../lib/batchState'

const frame: StoredFrame = {
  dataUrl: 'data:image/png;base64,FRAME',
  width: 1080,
  height: 1920,
  aperture: { x: 120, y: 200, width: 840, height: 1260 },
}

const autoAdjust: Adjustment = { panX: 0, panY: 0, zoom: 1, rotation: 0 }

const pictures: BatchPicture[] = [
  { id: '1', name: 'a.jpg', width: 800, height: 600, previewUrl: 'data:preview-a', status: 'ready', adjustment: autoAdjust },
  { id: '2', name: 'b.heic', width: 600, height: 800, previewUrl: 'data:preview-b', status: 'ready', adjustment: autoAdjust },
  { id: '3', name: 'broken.jpg', width: 0, height: 0, previewUrl: '', status: 'error', error: 'Could not read Picture broken.jpg', adjustment: autoAdjust },
]

describe('VisualGrid', () => {
  it('shows the total picture count and batch status prominently', () => {
    render(<VisualGrid frame={frame} pictures={pictures} loading={false} onClear={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent(/3 pictures/i)
    expect(screen.getByRole('status')).toHaveTextContent(/2 ready/i)
    expect(screen.getByRole('status')).toHaveTextContent(/1 failed/i)
  })

  it('renders a responsive card per picture with the frame composited on top', () => {
    render(<VisualGrid frame={frame} pictures={pictures.slice(0, 2)} loading={false} onClear={() => {}} />)
    expect(screen.getByRole('img', { name: /a\.jpg framed/i })).toHaveAttribute('src', 'data:preview-a')
    expect(screen.getAllByRole('img', { name: /active frame/i })[0]).toHaveAttribute('src', frame.dataUrl)
    expect(screen.getByTestId('visual-grid')).toHaveClass('grid')
  })

  it('fits each picture inside the detected aperture box', () => {
    render(<VisualGrid frame={frame} pictures={pictures.slice(0, 1)} loading={false} onClear={() => {}} />)
    const box = screen.getByTestId('aperture-box')
    // Aperture 120,200 840x1260 inside Frame 1080x1920
    expect(box.style.left).toContain('11.11')
    expect(box.style.top).toContain('10.41')
    expect(box.style.width).toContain('77.77')
  })

  it('shows per-picture errors without dropping the rest of the batch', () => {
    render(<VisualGrid frame={frame} pictures={pictures} loading={false} onClear={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not read Picture broken.jpg')
    expect(screen.getByRole('img', { name: /a\.jpg framed/i })).toBeInTheDocument()
  })

  it('clears the batch on request', () => {
    const onClear = vi.fn()
    render(<VisualGrid frame={frame} pictures={pictures.slice(0, 1)} loading={false} onClear={onClear} />)
    fireEvent.click(screen.getByRole('button', { name: /clear batch/i }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('can disable Clear Batch while the Adjustment Modal holds in-progress work', () => {
    const onClear = vi.fn()
    render(
      <VisualGrid
        frame={frame}
        pictures={pictures.slice(0, 1)}
        loading={false}
        clearDisabled
        onClear={onClear}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /clear batch/i }))
    expect(onClear).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /clear batch/i })).toBeDisabled()
  })

  it('shows an empty state when the batch has no pictures', () => {
    render(<VisualGrid frame={frame} pictures={[]} loading={false} onClear={() => {}} />)
    expect(screen.getByText(/drop a directory above/i)).toBeInTheDocument()
  })

  it('explains that no Framed Pictures exist yet', () => {
    render(<VisualGrid frame={frame} pictures={[]} loading={false} onClear={() => {}} />)
    expect(screen.getByTestId('visual-grid-empty-state')).toHaveTextContent(/no framed pictures yet/i)
    expect(screen.getByTestId('visual-grid-empty-state')).toHaveTextContent(/add pictures/i)
  })

  it('explains Crop Mode and Batch Export with help tooltips', () => {
    render(
      <VisualGrid
        frame={frame}
        pictures={pictures.slice(0, 1)}
        loading={false}
        cropMode="crop-to-fill"
        onCropModeChange={() => {}}
        onBatchExport={() => {}}
        onClear={() => {}}
      />,
    )
    const cropHelp = screen.getByRole('button', { name: /about crop mode/i })
    fireEvent.focus(cropHelp)
    expect(screen.getByRole('tooltip')).toHaveTextContent(/crop mode/i)
    expect(screen.getByRole('tooltip')).toHaveTextContent(/fill the aperture/i)
    fireEvent.blur(cropHelp)

    const exportHelp = screen.getByRole('button', { name: /about batch export/i })
    fireEvent.focus(exportHelp)
    expect(screen.getByRole('tooltip')).toHaveTextContent(/batch export/i)
    expect(screen.getByRole('tooltip')).toHaveTextContent(/zip archive/i)
    fireEvent.blur(exportHelp)

    const autoHelp = screen.getByRole('button', { name: /about auto-centering/i })
    fireEvent.focus(autoHelp)
    expect(screen.getByRole('tooltip')).toHaveTextContent(/auto-centering/i)
    fireEvent.blur(autoHelp)
  })

  it('renders the Crop Mode toggle with Crop to Fill selected by default', () => {
    render(
      <VisualGrid
        frame={frame}
        pictures={pictures.slice(0, 1)}
        loading={false}
        cropMode="crop-to-fill"
        onCropModeChange={() => {}}
        onClear={() => {}}
      />,
    )
    const fillButton = screen.getByRole('radio', { name: /crop to fill/i })
    const blurredButton = screen.getByRole('radio', { name: /fit with blurred background/i })
    expect(fillButton).toHaveAttribute('aria-checked', 'true')
    expect(blurredButton).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onCropModeChange when switching crop mode', () => {
    const onCropModeChange = vi.fn()
    render(
      <VisualGrid
        frame={frame}
        pictures={pictures.slice(0, 1)}
        loading={false}
        cropMode="crop-to-fill"
        onCropModeChange={onCropModeChange}
        onClear={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('radio', { name: /fit with blurred background/i }))
    expect(onCropModeChange).toHaveBeenCalledWith('fit-blurred')
  })

  it('moves the roving tabindex onto the checked Crop Mode radio', () => {
    render(
      <VisualGrid
        frame={frame}
        pictures={pictures.slice(0, 1)}
        loading={false}
        cropMode="fit-blurred"
        onCropModeChange={() => {}}
        onClear={() => {}}
      />,
    )
    expect(screen.getByRole('radio', { name: /fit with blurred background/i })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: /crop to fill/i })).toHaveAttribute('tabindex', '-1')
  })

  it('switches Crop Mode and moves focus with the arrow keys', () => {
    const onCropModeChange = vi.fn()
    render(
      <VisualGrid
        frame={frame}
        pictures={pictures.slice(0, 1)}
        loading={false}
        cropMode="crop-to-fill"
        onCropModeChange={onCropModeChange}
        onClear={() => {}}
      />,
    )
    const group = screen.getByRole('radiogroup', { name: /crop mode/i })
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(onCropModeChange).toHaveBeenCalledTimes(1)
    expect(onCropModeChange).toHaveBeenCalledWith('fit-blurred')
    // Focus follows the newly checked radio (the state mock keeps the DOM
    // showing crop-to-fill checked, so Tab wraps there).
    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    expect(onCropModeChange).toHaveBeenCalledTimes(2)
  })

  it('applies auto-centering focal point object-position in Crop to Fill mode', () => {
    const picWithFocal: BatchPicture = {
      ...pictures[0],
      focalPoint: { x: 0.25, y: 0.75 },
    }
    render(
      <VisualGrid
        frame={frame}
        pictures={[picWithFocal]}
        loading={false}
        cropMode="crop-to-fill"
        onClear={() => {}}
      />,
    )
    const img = screen.getByRole('img', { name: /a\.jpg framed/i })
    expect(img).toHaveClass('object-cover')
    expect(img.style.objectPosition).toBe('0% 50%')
  })

  it('renders blurred background and contained foreground in Fit with Blurred Background mode', () => {
    render(
      <VisualGrid
        frame={frame}
        pictures={pictures.slice(0, 1)}
        loading={false}
        cropMode="fit-blurred"
        onClear={() => {}}
      />,
    )
    const apertureBox = screen.getByTestId('aperture-box')
    const blurredBg = apertureBox.querySelector('img[aria-hidden="true"]')
    expect(blurredBg).toBeInTheDocument()
    expect(blurredBg).toHaveClass('blur-md')
    const fg = screen.getByRole('img', { name: /a\.jpg framed/i })
    expect(fg).toHaveClass('object-contain')
  })

  it('opens the Adjustment Modal when the preview is clicked', () => {
    const onOpenAdjustment = vi.fn()
    render(
      <VisualGrid
        frame={frame}
        pictures={pictures.slice(0, 1)}
        loading={false}
        onOpenAdjustment={onOpenAdjustment}
        onClear={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /adjust a\.jpg/i }))
    expect(onOpenAdjustment).toHaveBeenCalledWith('1')
  })

  it('does not open the Adjustment Modal from the Remove or Download buttons', () => {
    const onOpenAdjustment = vi.fn()
    const onDownload = vi.fn()
    render(
      <VisualGrid
        frame={frame}
        pictures={pictures.slice(0, 1)}
        loading={false}
        onOpenAdjustment={onOpenAdjustment}
        onDownload={onDownload}
        onRemove={() => {}}
        onClear={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /download picture/i }))
    fireEvent.click(screen.getByRole('button', { name: /remove picture/i }))
    expect(onOpenAdjustment).not.toHaveBeenCalled()
  })

  it('removes a Picture only after an inline two-step confirmation', () => {
    const onRemove = vi.fn()
    render(
      <VisualGrid
        frame={frame}
        pictures={pictures.slice(0, 1)}
        loading={false}
        onRemove={onRemove}
        onClear={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /remove picture/i }))
    expect(onRemove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /confirm remove/i }))
    expect(onRemove).toHaveBeenCalledWith('1')
  })

  it('downloads one Picture on request', () => {
    const onDownload = vi.fn()
    render(
      <VisualGrid
        frame={frame}
        pictures={pictures.slice(0, 1)}
        loading={false}
        onDownload={onDownload}
        onClear={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /download picture/i }))
    expect(onDownload).toHaveBeenCalledWith('1')
  })

  it('reflects a manual adjustment in the card preview', () => {
    const adjusted: BatchPicture = {
      ...pictures[0],
      adjustment: { panX: 0.25, panY: -0.1, zoom: 2, rotation: 90 },
    }
    render(<VisualGrid frame={frame} pictures={[adjusted]} loading={false} onClear={() => {}} />)
    const img = screen.getByRole('img', { name: /a\.jpg framed/i })
    expect(img.style.transform).toContain('translate(25%, -10%)')
    expect(img.style.transform).toContain('scale(2)')
    expect(img.style.transform).toContain('rotate(90deg)')
  })

  it('opens the Batch Export naming dialog on request', () => {
    const onBatchExport = vi.fn()
    render(
      <VisualGrid
        frame={frame}
        pictures={pictures.slice(0, 1)}
        loading={false}
        onBatchExport={onBatchExport}
        onClear={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /export all as zip/i }))
    expect(onBatchExport).toHaveBeenCalledTimes(1)
  })

  it('disables Export All as ZIP while the Adjustment Modal or a run blocks it', () => {
    const onBatchExport = vi.fn()
    render(
      <VisualGrid
        frame={frame}
        pictures={pictures.slice(0, 1)}
        loading={false}
        onBatchExport={onBatchExport}
        batchExportDisabled
        onClear={() => {}}
      />,
    )
    const button = screen.getByRole('button', { name: /export all as zip/i })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onBatchExport).not.toHaveBeenCalled()
  })

  it('blocks Picture adjustments for the duration of a Batch Export', () => {
    const onOpenAdjustment = vi.fn()
    render(
      <VisualGrid
        frame={frame}
        pictures={pictures.slice(0, 1)}
        loading={false}
        adjustDisabled
        onOpenAdjustment={onOpenAdjustment}
        onClear={() => {}}
      />,
    )
    const adjust = screen.getByRole('button', { name: /adjust a\.jpg/i })
    expect(adjust).toBeDisabled()
    fireEvent.click(adjust)
    expect(onOpenAdjustment).not.toHaveBeenCalled()
  })

  describe('Frame reactivity', () => {
    it('reactively adjusts card aspect ratio and aperture bounds when switching active Frame', () => {
      const squareFrame: StoredFrame = {
        dataUrl: 'data:image/png;base64,SQUARE',
        width: 1080,
        height: 1080,
        aperture: { x: 108, y: 108, width: 864, height: 864 },
      }

      const storyFrame: StoredFrame = {
        dataUrl: 'data:image/png;base64,STORY',
        width: 1080,
        height: 1920,
        aperture: { x: 120, y: 200, width: 840, height: 1260 },
      }

      const { rerender } = render(
        <VisualGrid frame={squareFrame} pictures={pictures.slice(0, 2)} loading={false} onClear={() => {}} />,
      )

      // Initial 1:1 square frame assertions
      const initialCard = screen.getByRole('button', { name: /adjust a\.jpg/i })
      expect(initialCard.style.aspectRatio).toBe('1080 / 1080')
      let box = screen.getAllByTestId('aperture-box')[0]
      expect(box.style.left).toBe('10%')
      expect(box.style.top).toBe('10%')
      expect(box.style.width).toBe('80%')
      expect(box.style.height).toBe('80%')

      // Switch active Frame to 9:16 story frame
      rerender(
        <VisualGrid frame={storyFrame} pictures={pictures.slice(0, 2)} loading={false} onClear={() => {}} />,
      )

      // Card aspect ratio and aperture update immediately while keeping the batch pictures
      const updatedCard = screen.getByRole('button', { name: /adjust a\.jpg/i })
      expect(updatedCard.style.aspectRatio).toBe('1080 / 1920')
      box = screen.getAllByTestId('aperture-box')[0]
      expect(box.style.left).toContain('11.11')
      expect(box.style.top).toContain('10.41')
      expect(box.style.width).toContain('77.77')

      // The Batch pictures remain fully intact
      expect(screen.getByRole('img', { name: /a\.jpg framed/i })).toBeInTheDocument()
      expect(screen.getByRole('img', { name: /b\.heic framed/i })).toBeInTheDocument()
    })
  })
})

