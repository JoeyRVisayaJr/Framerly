import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./pictureExport', () => ({
  renderFramedPictureFile: vi.fn(),
  triggerDownloadDefault: vi.fn(),
}))

import {
  canUseWorkerRendering,
  createDefaultPictureRenderer,
  createWorkerPictureRenderer,
  type RenderPictureJob,
} from './batchExport'
import { renderFramedPictureFile } from './pictureExport'

type Listener = (event: { message?: string; data?: unknown }) => void

class FakeWorker {
  static mode: 'respond' | 'render-error' | 'worker-error' = 'respond'
  static lastInstance: FakeWorker | null = null
  static response = new Blob(['worker'])

  listeners = new Map<string, Set<Listener>>()
  terminated = false

  constructor(url: string | URL) {
    void url
    FakeWorker.lastInstance = this
  }

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? new Set<Listener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener)
  }

  postMessage(message: { id: number }): void {
    if (FakeWorker.mode === 'worker-error') {
      queueMicrotask(() => this.emit('error', { message: 'worker blew up' }))
      return
    }
    if (FakeWorker.mode === 'render-error') {
      queueMicrotask(() => this.emit('message', { data: { id: message.id, error: 'Could not decode Picture' } }))
      return
    }
    queueMicrotask(() =>
      this.emit('message', { data: { id: message.id, blob: FakeWorker.response } }),
    )
  }

  terminate(): void {
    this.terminated = true
  }

  emit(type: string, event: { message?: string; data?: unknown }): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

class FakeOffscreenCanvas {
  constructor(
    public width: number,
    public height: number,
  ) {}

  getContext(): object {
    return {}
  }
}

const job: RenderPictureJob = {
  file: new File(['x'], 'IMG_0412.jpg', { type: 'image/jpeg' }),
  frame: {
    dataUrl: 'data:image/png;base64,AAA',
    width: 1080,
    height: 1920,
    aperture: { x: 120, y: 200, width: 840, height: 1260 },
  },
  cropMode: 'crop-to-fill',
  focalPoint: { x: 0.5, y: 0.5 },
  adjustment: { panX: 0, panY: 0, zoom: 1, rotation: 0 },
  format: 'jpeg',
}

function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

beforeEach(() => {
  FakeWorker.mode = 'respond'
  FakeWorker.lastInstance = null
  vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker)
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas as unknown as typeof OffscreenCanvas)
  vi.stubGlobal('createImageBitmap', vi.fn())
  vi.mocked(renderFramedPictureFile).mockResolvedValue({
    blob: new Blob(['main']),
    filename: 'IMG_0412.jpg',
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(renderFramedPictureFile).mockReset()
})

describe('Batch Export renderer selection', () => {
  it('reports the Worker capability from OffscreenCanvas support', () => {
    expect(canUseWorkerRendering()).toBe(true)
    vi.stubGlobal('OffscreenCanvas', undefined)
    expect(canUseWorkerRendering()).toBe(false)
  })

  it('renders through the Worker when the capability exists', async () => {
    const renderer = createWorkerPictureRenderer()
    expect(renderer).not.toBeNull()

    const blob = await renderer!.render(job)
    expect(await blobText(blob)).toBe('worker')
    expect(renderFramedPictureFile).not.toHaveBeenCalled()

    renderer!.dispose()
    expect(FakeWorker.lastInstance?.terminated).toBe(true)
  })

  it('keeps Picture-specific Worker errors as run failures', async () => {
    FakeWorker.mode = 'render-error'
    const renderer = createDefaultPictureRenderer()

    await expect(renderer.render(job)).rejects.toThrow('Could not decode Picture')
    expect(renderFramedPictureFile).not.toHaveBeenCalled()
  })

  it('falls back to the main-thread renderer when the Worker itself dies', async () => {
    FakeWorker.mode = 'worker-error'
    const renderer = createDefaultPictureRenderer()

    const first = await renderer.render(job)
    expect(await blobText(first)).toBe('main')
    expect(renderFramedPictureFile).toHaveBeenCalledTimes(1)

    // The dead Worker is not reused for the next Picture.
    const second = await renderer.render(job)
    expect(await blobText(second)).toBe('main')
    expect(renderFramedPictureFile).toHaveBeenCalledTimes(2)
  })
})
