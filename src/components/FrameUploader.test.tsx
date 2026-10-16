import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FrameUploader } from './FrameUploader'
import type { StoredFrame } from '../lib/frameStore'

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
    expect(screen.getByTestId('aperture-overlay')).toBeInTheDocument()
  })

  it('explains opaque frames without an aperture', () => {
    render(
      <FrameUploader
        frame={{ ...frame, aperture: null }}
        loading={false}
        error={null}
        onSelect={() => {}}
        onClear={() => {}}
      />,
    )
    expect(screen.getByText(/no transparent aperture/i)).toBeInTheDocument()
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
})
