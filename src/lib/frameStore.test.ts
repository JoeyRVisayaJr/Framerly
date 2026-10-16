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

const sample: StoredFrame = {
  dataUrl: 'data:image/png;base64,AAA',
  width: 1080,
  height: 1920,
  aperture: { x: 120, y: 200, width: 840, height: 1260 },
}

function pngFile(name = 'frame.png', type = 'image/png'): File {
  return new File(['x'], name, { type })
}

describe('frameStore persistence', () => {
  it('round-trips a stored frame', () => {
    const storage = memoryStorage()
    expect(loadFrame(storage)).toBeNull()
    saveFrame(storage, sample)
    expect(loadFrame(storage)).toEqual(sample)
  })

  it('clears the stored frame', () => {
    const storage = memoryStorage()
    saveFrame(storage, sample)
    clearFrame(storage)
    expect(loadFrame(storage)).toBeNull()
  })

  it('returns null for corrupt stored data instead of throwing', () => {
    const storage = memoryStorage()
    storage.setItem('framerly.frame.v1', '{not json')
    expect(loadFrame(storage)).toBeNull()
  })

  it('returns null when required fields are missing', () => {
    const storage = memoryStorage()
    storage.setItem('framerly.frame.v1', JSON.stringify({ width: 10 }))
    expect(loadFrame(storage)).toBeNull()
  })
})

describe('isPngFile', () => {
  it('accepts PNG files by type or extension', () => {
    expect(isPngFile(pngFile())).toBe(true)
    expect(isPngFile(new File(['x'], 'FRAME.PNG', { type: '' }))).toBe(true)
  })

  it('rejects non-PNG files', () => {
    expect(isPngFile(new File(['x'], 'pic.jpg', { type: 'image/jpeg' }))).toBe(false)
    expect(isPngFile(new File(['x'], 'notes.txt', { type: 'text/plain' }))).toBe(false)
  })
})
