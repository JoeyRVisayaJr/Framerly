import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FrameUploader } from './FrameUploader'
import type { StoredFrame } from '../lib/storage'

const frame: StoredFrame = {
  dataUrl: 'data:image/png;base64,AAA',
  width: 1080,
  height: 1920,
  aperture: { x: 120, y: 200, width: 840, height: 1260 },
}

describe('FrameUploader', () => {
  it('shows the dropzone when no frame is loaded', () => {
    render(<FrameUploader frame={null} loading={false} error={null} onSelect={() => {}} onClear={() => {}} />)
    expect(screen.getByText(/drop a png frame/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/choose a png frame/i)).toBeInTheDocument()
  })

  it('calls onSelect when a file is chosen', () => {
    const onSelect = vi.fn()
    render(<FrameUploader frame={null} loading={false} error={null} onSelect={onSelect} onClear={() => {}} />)
    const file = new File(['x'], 'frame.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText(/choose a png frame/i), { target: { files: [file] } })
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0]).toBe(file)
  })

  it('shows a loading state while decoding', () => {
    render(<FrameUploader frame={null} loading error={null} onSelect={() => {}} onClear={() => {}} />)
    expect(screen.getByText(/reading frame/i)).toBeInTheDocument()
  })

  it('shows the preview with aperture dimensions', () => {
    render(<FrameUploader frame={frame} loading={false} error={null} onSelect={() => {}} onClear={() => {}} />)
    expect(screen.getByRole('img', { name: /frame preview/i })).toHaveAttribute('src', frame.dataUrl)
    expect(screen.getByText(/1080.*1920/)).toBeInTheDocument()
    expect(screen.getByTestId('aperture-box')).toBeInTheDocument()
  })

  it('explains opaque frames without an aperture and offers calibration', () => {
    const onCalibrate = vi.fn()
    render(
      <FrameUploader
        frame={{ ...frame, aperture: null }}
        loading={false}
        error={null}
        onSelect={() => {}}
        onClear={() => {}}
        onCalibrate={onCalibrate}
      />,
    )
    expect(screen.getByText(/no transparent aperture/i)).toBeInTheDocument()
    const calibrateBtn = screen.getByRole('button', { name: /calibrate aperture/i })
    expect(calibrateBtn).toBeInTheDocument()

    fireEvent.click(calibrateBtn)
    expect(screen.getByText(/Aperture: 864 x 1536/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /confirm calibration/i }))
    expect(onCalibrate).toHaveBeenCalledTimes(1)
  })

  it('offers adjust aperture when aperture is detected', () => {
    render(
      <FrameUploader
        frame={frame}
        loading={false}
        error={null}
        onSelect={() => {}}
        onClear={() => {}}
      />,
    )
    const adjustBtn = screen.getByRole('button', { name: /adjust aperture/i })
    expect(adjustBtn).toBeInTheDocument()

    fireEvent.click(adjustBtn)
    expect(screen.getByText(/Aperture: 840 x 1260/)).toBeInTheDocument()
  })

  it('replaces the frame via drag and drop onto the preview', () => {
    const onSelect = vi.fn()
    render(<FrameUploader frame={frame} loading={false} error={null} onSelect={onSelect} onClear={() => {}} />)
    const file = new File(['x'], 'other.png', { type: 'image/png' })
    fireEvent.drop(screen.getByRole('img', { name: /frame preview/i }).parentElement!, {
      dataTransfer: { files: [file] },
    })
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0]).toBe(file)
  })

  it('shows errors and clears the frame on request', () => {
    const onClear = vi.fn()
    render(<FrameUploader frame={frame} loading={false} error="Frame must be a PNG file" onSelect={() => {}} onClear={onClear} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Frame must be a PNG file')
    fireEvent.click(screen.getByRole('button', { name: /clear frame/i }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('explains that no Frame is uploaded yet', () => {
    render(<FrameUploader frame={null} loading={false} error={null} onSelect={() => {}} onClear={() => {}} />)
    expect(screen.getByTestId('frame-empty-state')).toHaveTextContent(/no frame yet/i)
    expect(screen.getByTestId('frame-empty-state')).toHaveTextContent(/png frame/i)
  })

  it('shows drop feedback on drag over and clears it on drop', () => {
    render(<FrameUploader frame={null} loading={false} error={null} onSelect={() => {}} onClear={() => {}} />)
    const zone = screen.getByText(/drop a png frame here/i).closest('div')!
    fireEvent.dragOver(zone, {})
    expect(zone).toHaveAttribute('data-drop-state', 'accepted')
    expect(zone).toHaveTextContent(/release to replace/i)
    fireEvent.drop(zone, { dataTransfer: { files: [] } })
    expect(zone).not.toHaveAttribute('data-drop-state')
  })

  it('explains the Aperture with a help tooltip', () => {
    render(<FrameUploader frame={frame} loading={false} error={null} onSelect={() => {}} onClear={() => {}} />)
    const trigger = screen.getByRole('button', { name: /about the aperture/i })
    fireEvent.focus(trigger)
    expect(screen.getByRole('tooltip')).toHaveTextContent(/transparent region/i)
  })
})
