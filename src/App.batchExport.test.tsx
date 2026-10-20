import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { saveFrame } from './lib/frameStore'
import { runBatchExport, type BatchExportResult } from './lib/batchExport'
import { decodePictureFile } from './lib/pictureDecode'

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
  triggerDownloadDefault: vi.fn(),
  renderFramedPictureFile: vi.fn(),
  EXPORT_JPEG_QUALITY: 0.92,
}))

vi.mock('./lib/batchExport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/batchExport')>()
  return { ...actual, runBatchExport: vi.fn() }
})

const exportResult: BatchExportResult = {
  status: 'completed',
  archiveName: 'framerly-2026-10-20.zip',
  total: 1,
  processed: 1,
  succeeded: 1,
  failed: [],
  renamed: [],
  downloaded: true,
}

function saveTestFrame() {
  saveFrame(window.localStorage, {
    dataUrl: 'data:image/png;base64,AAA',
    width: 1080,
    height: 1920,
    aperture: { x: 120, y: 200, width: 840, height: 1260 },
  })
}

async function dropPictures(names = ['IMG_0412.jpg']) {
  const files = names.map((name) => new File(['x'], name, { type: 'image/jpeg' }))
  const dropzone = screen.getByText(/drop event pictures here/i).closest('div')!
  fireEvent.drop(dropzone, { dataTransfer: { files } })
  await waitFor(() => {
    for (const name of names) {
      expect(screen.getByRole('button', { name: new RegExp(`adjust ${name.replace('.', '\\.')}`, 'i') })).toBeInTheDocument()
    }
  })
}

async function openNamingDialog() {
  fireEvent.click(screen.getByRole('button', { name: /export all as zip/i }))
  return screen.getByRole('dialog', { name: /export all as zip/i })
}

function submitNamingDialog(name = 'event-recap') {
  const dialog = screen.getByRole('dialog', { name: /export all as zip/i })
  fireEvent.change(within(dialog).getByRole('textbox', { name: /archive name/i }), {
    target: { value: name },
  })
  fireEvent.submit(within(dialog).getByRole('textbox', { name: /archive name/i }).closest('form')!)
}

beforeEach(() => {
  saveTestFrame()
})

afterEach(() => {
  window.localStorage.clear()
  vi.mocked(runBatchExport).mockReset()
})

describe('App Batch Export wiring', () => {
  it('opens the naming dialog from Export All as ZIP', async () => {
    render(<App />)
    await dropPictures()
    const dialog = await openNamingDialog()
    expect(
      (within(dialog).getByRole('textbox', { name: /archive name/i }) as HTMLInputElement).value,
    ).toMatch(/^framerly-\d{4}-\d{2}-\d{2}$/)
  })

  it('starts the export with the chosen name and shows live progress then Packaging', async () => {
    type Hooks = {
      progress?: (processed: number) => void
      packaging?: () => void
      finish?: () => void
    }
    const hooks: Hooks = {}
    vi.mocked(runBatchExport).mockImplementation(
      async (_input, deps) =>
        new Promise<BatchExportResult>((resolve) => {
          hooks.progress = (processed) =>
            deps?.onProgress?.({ processed, total: 1, currentName: 'IMG_0412.jpg' })
          hooks.packaging = () => deps?.onPackaging?.()
          hooks.finish = () => resolve(exportResult)
        }),
    )
    render(<App />)
    await dropPictures()
    await openNamingDialog()
    submitNamingDialog('event-recap')

    const progressRegion = () =>
      screen.getByRole('region', { name: /batch export progress/i })
    await waitFor(() => {
      expect(within(progressRegion()).getByRole('status')).toHaveTextContent('0 of 1 Pictures')
    })
    act(() => hooks.progress?.(1))
    await waitFor(() => {
      expect(within(progressRegion()).getByRole('status')).toHaveTextContent('1 of 1 Pictures')
    })
    act(() => hooks.packaging?.())
    expect(await screen.findByText('Packaging…')).toBeInTheDocument()
    expect(runBatchExport).toHaveBeenCalledWith(
      expect.objectContaining({ archiveName: 'event-recap.zip', format: 'jpeg' }),
      expect.anything(),
    )
    expect(screen.getByRole('button', { name: /export all as zip/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /adjust img_0412/i })).toBeDisabled()

    act(() => hooks.finish?.())
    await waitFor(() => expect(screen.queryByLabelText(/batch export progress/i)).not.toBeInTheDocument())
  })

  it('uses the chosen PNG format for one Batch Export', async () => {
    vi.mocked(runBatchExport).mockResolvedValue(exportResult)
    render(<App />)
    await dropPictures()
    const dialog = await openNamingDialog()
    fireEvent.click(within(dialog).getByRole('radio', { name: /png/i }))
    submitNamingDialog('lossless')

    await waitFor(() => {
      expect(runBatchExport).toHaveBeenCalledWith(
        expect.objectContaining({ archiveName: 'lossless.zip', format: 'png' }),
        expect.anything(),
      )
    })
  })

  it('names failed Pictures and renamed duplicates in one completion notice', async () => {
    vi.mocked(runBatchExport).mockResolvedValue({
      ...exportResult,
      total: 3,
      succeeded: 1,
      failed: [
        { name: 'broken.jpg', message: 'Could not decode' },
        { name: 'also-broken.jpg', message: 'Could not decode' },
      ],
      renamed: [{ original: 'IMG_0412.jpg', assigned: 'IMG_0412 (2).jpg' }],
    })
    render(<App />)
    await dropPictures()
    await openNamingDialog()
    submitNamingDialog()

    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent('broken.jpg')
    expect(notice).toHaveTextContent('also-broken.jpg')
    expect(notice).toHaveTextContent('IMG_0412 (2).jpg')
  })

  it('cancels the run between Pictures and discards the partial archive', async () => {
    let signal: AbortSignal | undefined
    vi.mocked(runBatchExport).mockImplementation(
      (input) =>
        new Promise<BatchExportResult>((resolve) => {
          signal = input.signal
          input.signal?.addEventListener('abort', () =>
            resolve({ ...exportResult, status: 'cancelled', downloaded: false, succeeded: 0 }),
          )
        }),
    )
    render(<App />)
    await dropPictures()
    await openNamingDialog()
    submitNamingDialog()

    fireEvent.click(await screen.findByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(signal?.aborted).toBe(true))
    expect(await screen.findByRole('alert')).toHaveTextContent(/cancelled/i)
  })

  it('restores focus to Export All as ZIP after closing the naming dialog', async () => {
    render(<App />)
    await dropPictures()
    const exportButton = screen.getByRole('button', { name: /export all as zip/i })
    fireEvent.click(exportButton)
    expect(screen.getByRole('dialog', { name: /export all as zip/i })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export all as zip/i })).toHaveFocus()
    })
  })

  it('disables Batch Export while the Batch is still ingesting', async () => {
    let resolveDecode: (value: Awaited<ReturnType<typeof decodePictureFile>>) => void = () => {}
    vi.mocked(decodePictureFile).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDecode = resolve
        }),
    )
    render(<App />)
    const file = new File(['x'], 'IMG_0412.jpg', { type: 'image/jpeg' })
    fireEvent.drop(screen.getByText(/drop event pictures here/i).closest('div')!, {
      dataTransfer: { files: [file] },
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export all as zip/i })).toBeDisabled()
    })

    await act(async () => {
      resolveDecode({
        name: file.name,
        width: 800,
        height: 600,
        previewUrl: 'data:image/jpeg;base64,PREVIEW',
        focalPoint: { x: 0.5, y: 0.4 },
      })
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export all as zip/i })).toBeEnabled()
    })
  })

  it('disables Batch Export while the Adjustment Modal is open', async () => {
    render(<App />)
    await dropPictures()
    fireEvent.click(screen.getByRole('button', { name: /adjust img_0412/i }))
    expect(screen.getByRole('dialog', { name: /adjust img_0412/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export all as zip/i })).toBeDisabled()
  })
})
