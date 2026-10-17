import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { saveFrame } from './lib/frameStore'
import { downloadFramedPicture } from './lib/pictureExport'

vi.mock('./lib/pictureDecode', () => ({
  decodePictureFile: vi.fn(async (file: File) => ({
    name: file.name,
    width: 800,
    height: 600,
    previewUrl: 'data:image/jpeg;base64,PREVIEW',
    focalPoint: { x: 0.5, y: 0.4 },
  })),
}))

vi.mock('./lib/pictureExport', () => ({
  downloadFramedPicture: vi.fn(),
}))

afterEach(() => {
  window.localStorage.clear()
  vi.mocked(downloadFramedPicture).mockReset()
})

function saveTestFrame() {
  saveFrame(window.localStorage, {
    dataUrl: 'data:image/png;base64,AAA',
    width: 1080,
    height: 1920,
    aperture: { x: 120, y: 200, width: 840, height: 1260 },
  })
}

async function dropOnePicture() {
  const file = new File(['x'], 'IMG_0412.jpg', { type: 'image/jpeg' })
  const dropzone = screen.getByText(/drop event pictures here/i).closest('div')!
  fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
  return screen.findByRole('button', { name: /adjust img_0412\.jpg/i })
}

describe('App Batch and Adjustment wiring', () => {
  it('renders the Framerly heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /framerly/i })).toBeInTheDocument()
  })

  it('restores a persisted frame on load', () => {
    saveTestFrame()
    render(<App />)
    expect(screen.getByRole('img', { name: /frame preview/i })).toBeInTheDocument()
  })

  it('opens the Adjustment Modal when a Visual Grid card preview is clicked', async () => {
    saveTestFrame()
    render(<App />)
    fireEvent.click(await dropOnePicture())
    expect(screen.getByRole('dialog', { name: /adjust img_0412\.jpg/i })).toBeInTheDocument()
  })

  it('reports a failed single-Picture download and keeps the modal open', async () => {
    saveTestFrame()
    vi.mocked(downloadFramedPicture).mockRejectedValue(new Error('encode failed'))
    render(<App />)
    fireEvent.click(await dropOnePicture())

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /download picture/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('IMG_0412.jpg')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('downloads the full-resolution Framed Picture with the current adjustment', async () => {
    saveTestFrame()
    vi.mocked(downloadFramedPicture).mockResolvedValue(undefined)
    render(<App />)
    fireEvent.click(await dropOnePicture())

    fireEvent.change(screen.getByRole('slider', { name: /zoom/i }), { target: { value: '2' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /download picture/i }))

    await waitFor(() => expect(downloadFramedPicture).toHaveBeenCalledTimes(1))
    const input = vi.mocked(downloadFramedPicture).mock.calls[0][0]
    expect(input.file.name).toBe('IMG_0412.jpg')
    expect(input.cropMode).toBe('crop-to-fill')
    expect(input.adjustment).toEqual({ panX: 0, panY: 0, zoom: 2, rotation: 0 })
    expect(input.frame?.width).toBe(1080)
  })
})
