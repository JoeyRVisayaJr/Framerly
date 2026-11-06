import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { defaultFramePresetStore, saveFrame } from './lib/storage'
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

beforeEach(async () => {
  await defaultFramePresetStore.clear()
})

afterEach(async () => {
  window.localStorage.clear()
  await defaultFramePresetStore.clear()
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

  it('shows the download error inside the dialog while the modal is open', async () => {
    saveTestFrame()
    vi.mocked(downloadFramedPicture).mockRejectedValue(new Error('encode failed'))
    render(<App />)
    fireEvent.click(await dropOnePicture())

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /download picture/i }))

    await waitFor(() => {
      expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('encode failed')
    })
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

  it('names the Frame file when a corrupt image is rejected', async () => {
    render(<App />)
    const file = new File(['not a png'], 'broken-frame.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText(/choose a png frame/i), { target: { files: [file] } })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('broken-frame.png')
  })

  it('names the supported formats when no supported Pictures arrive', async () => {
    render(<App />)
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' })
    fireEvent.change(screen.getByLabelText(/choose pictures/i), { target: { files: [file] } })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/jpg/i)
    expect(alert).toHaveTextContent(/png/i)
    expect(alert).toHaveTextContent(/webp/i)
    expect(alert).toHaveTextContent(/heic/i)
  })

  it('shows frame drop feedback on drag over and clears it on drop', async () => {
    render(<App />)
    const zone = screen.getByText(/drop a png frame here/i).closest('div')!
    fireEvent.dragOver(zone, {})
    expect(zone).toHaveAttribute('data-drop-state', 'accepted')
    expect(zone).toHaveTextContent(/release to replace/i)
    fireEvent.drop(zone, { dataTransfer: { files: [] } })
    expect(zone).not.toHaveAttribute('data-drop-state')
  })

  it('shows batch drop feedback on drag over and clears it on drop', async () => {
    render(<App />)
    const zone = screen.getByText(/drop event pictures here/i).closest('div')!
    fireEvent.dragOver(zone, {})
    expect(zone).toHaveAttribute('data-drop-state', 'accepted')
    expect(zone).toHaveTextContent(/release to add/i)
    fireEvent.drop(zone, { dataTransfer: { files: [] } })
    expect(zone).not.toHaveAttribute('data-drop-state')
  })

  it('switches active Frame Preset and reactively updates Visual Grid without clearing the Batch', async () => {
    const blob = new Blob([new Uint8Array(10)], { type: 'image/png' })
    await defaultFramePresetStore.savePreset({
      name: 'Story 9:16',
      width: 1080,
      height: 1920,
      aperture: { x: 120, y: 200, width: 840, height: 1260 },
      blob,
      dataUrl: 'data:image/png;base64,STORY',
      createdAt: 1000,
    })

    await defaultFramePresetStore.savePreset({
      name: 'Square 1:1',
      width: 1080,
      height: 1080,
      aperture: { x: 108, y: 108, width: 864, height: 864 },
      blob,
      dataUrl: 'data:image/png;base64,SQUARE',
      createdAt: 2000,
    })

    render(<App />)

    // Wait for presets to load
    await screen.findByText('Story 9:16')
    expect(screen.getByText('Square 1:1')).toBeInTheDocument()

    // Add a picture to the Batch
    const pictureCard = await dropOnePicture()
    expect(pictureCard.style.aspectRatio).toBe('1080 / 1920')

    // Switch active Frame Preset to Square 1:1
    fireEvent.click(screen.getByRole('button', { name: /select square 1:1/i }))

    // Card reactively adjusts to 1080 / 1080 without requiring re-ingestion of the Batch
    await waitFor(() => {
      expect(pictureCard.style.aspectRatio).toBe('1080 / 1080')
    })
    expect(screen.getByRole('button', { name: /adjust img_0412\.jpg/i })).toBeInTheDocument()
  })

  it('allows renaming an existing Frame Preset with confirmation', async () => {
    const blob = new Blob([new Uint8Array(10)], { type: 'image/png' })
    await defaultFramePresetStore.savePreset({
      name: 'Gala 2026 - Story 9:16',
      width: 1080,
      height: 1920,
      aperture: null,
      blob,
      dataUrl: 'data:image/png;base64,AAA',
    })

    render(<App />)
    await screen.findByText('Gala 2026 - Story 9:16')

    fireEvent.click(screen.getByRole('button', { name: /rename gala 2026 - story 9:16/i }))
    const input = screen.getByLabelText(/rename preset/i)
    fireEvent.change(input, { target: { value: 'Gala 2026 - Final 9:16' } })
    fireEvent.click(screen.getByRole('button', { name: /save rename/i }))

    await screen.findByText('Gala 2026 - Final 9:16')
    expect(screen.queryByText('Gala 2026 - Story 9:16')).not.toBeInTheDocument()
  })

  it('deletes a Frame Preset after confirmation', async () => {
    const blob = new Blob([new Uint8Array(10)], { type: 'image/png' })
    await defaultFramePresetStore.savePreset({
      name: 'Gala 2026 - To Delete',
      width: 1080,
      height: 1920,
      aperture: null,
      blob,
      dataUrl: 'data:image/png;base64,AAA',
    })

    render(<App />)
    await screen.findByText('Gala 2026 - To Delete')

    fireEvent.click(screen.getByRole('button', { name: /delete gala 2026 - to delete/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm delete gala 2026 - to delete/i }))

    await waitFor(() => {
      expect(screen.queryByText('Gala 2026 - To Delete')).not.toBeInTheDocument()
    })
  })
})
