import { describe, expect, it } from 'vitest'
import {
  clearFrame,
  isPngFile,
  loadFrame,
  saveFrame,
  type StoredFrame,
} from './frameStore'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v)
    },
    removeItem: (k: string) => {
      map.delete(k)
    },
    clear: () => map.clear(),
  }
}

const sampleFrame: StoredFrame = {
  dataUrl: 'data:image/png;base64,SAMPLE',
  width: 1080,
  height: 1920,
  aperture: { x: 100, y: 150, width: 880, height: 1620 },
}

describe('frameStore persistence', () => {
  it('saves and reloads a valid Frame', () => {
    const storage = memoryStorage()
    saveFrame(storage, sampleFrame)
    const loaded = loadFrame(storage)
    expect(loaded).toEqual(sampleFrame)
  })

  it('returns null when storage is empty', () => {
    const storage = memoryStorage()
    expect(loadFrame(storage)).toBeNull()
  })

  it('clears a stored Frame', () => {
    const storage = memoryStorage()
    saveFrame(storage, sampleFrame)
    clearFrame(storage)
    expect(loadFrame(storage)).toBeNull()
  })

  it('returns null when storage holds malformed JSON', () => {
    const storage = memoryStorage()
    storage.setItem('framerly.frame.v1', '{not valid json')
    expect(loadFrame(storage)).toBeNull()
  })

  it('returns null when storage holds non-object JSON', () => {
    const storage = memoryStorage()
    storage.setItem('framerly.frame.v1', '"just a string"')
    expect(loadFrame(storage)).toBeNull()
  })

  it('returns null when dataUrl is missing or not a PNG data URL', () => {
    const storage = memoryStorage()
    storage.setItem(
      'framerly.frame.v1',
      JSON.stringify({ ...sampleFrame, dataUrl: 'http://example.com/frame.png' }),
    )
    expect(loadFrame(storage)).toBeNull()
  })

  it('returns null when aperture coordinates are invalid', () => {
    const storage = memoryStorage()
    storage.setItem(
      'framerly.frame.v1',
      JSON.stringify({
        ...sampleFrame,
        aperture: { x: 0, y: 0, width: -10, height: 100 },
      }),
    )
    expect(loadFrame(storage)).toBeNull()
  })
})

describe('isPngFile', () => {
  it('identifies PNG by MIME type', () => {
    const file = new File(['x'], 'frame', { type: 'image/png' })
    expect(isPngFile(file)).toBe(true)
  })

  it('identifies PNG by extension when MIME is generic', () => {
    const file = new File(['x'], 'event-frame.PNG', {
      type: 'application/octet-stream',
    })
    expect(isPngFile(file)).toBe(true)
  })

  it('rejects non-PNG files', () => {
    const file = new File(['x'], 'picture.jpg', { type: 'image/jpeg' })
    expect(isPngFile(file)).toBe(false)
  })
})

describe('decodeFrameFile error names', () => {
  it('names the Frame file when PNG decoding fails', async () => {
    const { decodeFrameFile } = await import('./frameStore')
    const file = new File(['not a png'], 'broken-frame.png', { type: 'image/png' })
    await expect(decodeFrameFile(file)).rejects.toThrow('broken-frame.png')
  })

  it('names the Frame file when the file type is unsupported', async () => {
    const { decodeFrameFile } = await import('./frameStore')
    const file = new File(['x'], 'pic.jpg', { type: 'image/jpeg' })
    await expect(decodeFrameFile(file)).rejects.toThrow('pic.jpg')
  })
})
