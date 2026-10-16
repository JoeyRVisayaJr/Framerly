import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VisualGrid } from './VisualGrid'
import type { StoredFrame } from '../lib/frameStore'
import type { BatchPicture } from '../lib/useBatch'

const frame: StoredFrame = {
  dataUrl: 'data:image/png;base64,FRAME',
  width: 1080,
  height: 1920,
  aperture: { x: 120, y: 200, width: 840, height: 1260 },
}

const pictures: BatchPicture[] = [
  { id: '1', name: 'a.jpg', width: 800, height: 600, previewUrl: 'data:preview-a', status: 'ready' },
  { id: '2', name: 'b.heic', width: 600, height: 800, previewUrl: 'data:preview-b', status: 'ready' },
  { id: '3', name: 'broken.jpg', width: 0, height: 0, previewUrl: '', status: 'error', error: 'Could not read Picture broken.jpg' },
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

  it('shows an empty state when the batch has no pictures', () => {
    render(<VisualGrid frame={frame} pictures={[]} loading={false} onClear={() => {}} />)
    expect(screen.getByText(/drop a directory above/i)).toBeInTheDocument()
  })
})
