import { beforeEach, describe, expect, it } from 'vitest'
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb'
import {
  blobToDataUrl,
  createFramePresetStore,
  dataUrlToBlob,
  type FramePresetInput,
} from './indexedDbFrameStore'

const SAMPLE_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function makeSampleBlob(bytes = 64): Blob {
  return new Blob([new Uint8Array(bytes)], { type: 'image/png' })
}

describe('indexedDbFrameStore (IndexedDB engine)', () => {
  let store: ReturnType<typeof createFramePresetStore>

  beforeEach(async () => {
    store = createFramePresetStore(fakeIndexedDB)
    await store.clear()
  })

  it('saves and lists Frame Presets', async () => {
    const input: FramePresetInput = {
      name: 'Event 2026 - Story',
      width: 1080,
      height: 1920,
      aperture: { x: 100, y: 150, width: 880, height: 1620 },
      blob: makeSampleBlob(),
      dataUrl: SAMPLE_DATA_URL,
    }

    const saved = await store.savePreset(input)
    expect(saved.id).toBeDefined()
    expect(saved.name).toBe('Event 2026 - Story')
    expect(saved.width).toBe(1080)
    expect(saved.height).toBe(1920)
    expect(saved.dataUrl).toBe(SAMPLE_DATA_URL)
    expect(saved.calibrated).toBe(false)

    const list = await store.listPresets()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(saved.id)
    expect(list[0].name).toBe('Event 2026 - Story')
  })

  it('generates a default name when name is omitted or whitespace', async () => {
    const saved = await store.savePreset({
      width: 1200,
      height: 800,
      aperture: null,
      blob: makeSampleBlob(),
    })
    expect(saved.name).toBe('Frame 1200 x 800')

    const saved2 = await store.savePreset({
      name: '   ',
      width: 800,
      height: 600,
      aperture: null,
      blob: makeSampleBlob(),
    })
    expect(saved2.name).toBe('Frame 800 x 600')
  })

  it('gets a single preset by ID', async () => {
    const saved = await store.savePreset({
      name: 'Single Target',
      width: 500,
      height: 500,
      aperture: { x: 50, y: 50, width: 400, height: 400 },
      blob: makeSampleBlob(),
      dataUrl: SAMPLE_DATA_URL,
    })

    const fetched = await store.getPreset(saved.id)
    expect(fetched).not.toBeNull()
    expect(fetched?.name).toBe('Single Target')
    expect(fetched?.aperture).toEqual({ x: 50, y: 50, width: 400, height: 400 })

    const nonExistent = await store.getPreset('does-not-exist')
    expect(nonExistent).toBeNull()
  })

  it('updates an existing preset', async () => {
    const saved = await store.savePreset({
      name: 'Initial Name',
      width: 1000,
      height: 1000,
      aperture: null,
      blob: makeSampleBlob(),
    })

    const updated = await store.updatePreset(saved.id, {
      name: 'Updated Name',
      aperture: { x: 10, y: 10, width: 980, height: 980 },
      calibrated: true,
    })

    expect(updated.name).toBe('Updated Name')
    expect(updated.calibrated).toBe(true)
    expect(updated.aperture).toEqual({ x: 10, y: 10, width: 980, height: 980 })

    const fetched = await store.getPreset(saved.id)
    expect(fetched?.name).toBe('Updated Name')
    expect(fetched?.calibrated).toBe(true)
  })

  it('throws when updating a non-existent preset', async () => {
    await expect(
      store.updatePreset('non-existent', { name: 'New Name' }),
    ).rejects.toThrow(/not found/i)
  })

  it('deletes a preset by ID', async () => {
    const saved = await store.savePreset({
      name: 'To Delete',
      width: 600,
      height: 600,
      aperture: null,
      blob: makeSampleBlob(),
    })

    expect(await store.listPresets()).toHaveLength(1)
    await store.deletePreset(saved.id)
    expect(await store.listPresets()).toHaveLength(0)
    expect(await store.getPreset(saved.id)).toBeNull()
  })

  it('clears all presets', async () => {
    await store.savePreset({ width: 100, height: 100, aperture: null, blob: makeSampleBlob() })
    await store.savePreset({ width: 200, height: 200, aperture: null, blob: makeSampleBlob() })
    expect(await store.listPresets()).toHaveLength(2)

    await store.clear()
    expect(await store.listPresets()).toHaveLength(0)
  })

  it('sorts presets by creation date ascending', async () => {
    await store.savePreset({
      name: 'Second',
      width: 100,
      height: 100,
      aperture: null,
      blob: makeSampleBlob(),
      createdAt: 2000,
    })
    await store.savePreset({
      name: 'First',
      width: 100,
      height: 100,
      aperture: null,
      blob: makeSampleBlob(),
      createdAt: 1000,
    })
    await store.savePreset({
      name: 'Third',
      width: 100,
      height: 100,
      aperture: null,
      blob: makeSampleBlob(),
      createdAt: 3000,
    })

    const list = await store.listPresets()
    expect(list.map((p) => p.name)).toEqual(['First', 'Second', 'Third'])
  })
})

describe('indexedDbFrameStore (In-memory fallback)', () => {
  it('falls back seamlessly when IndexedDB is unavailable (null factory)', async () => {
    const memoryStore = createFramePresetStore(null)
    expect(memoryStore.isAvailable()).toBe(false)

    const saved = await memoryStore.savePreset({
      name: 'Memory Preset',
      width: 800,
      height: 600,
      aperture: { x: 50, y: 50, width: 700, height: 500 },
      blob: makeSampleBlob(),
      dataUrl: SAMPLE_DATA_URL,
    })

    expect(saved.id).toBeDefined()
    expect(saved.name).toBe('Memory Preset')

    const list = await memoryStore.listPresets()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(saved.id)

    const fetched = await memoryStore.getPreset(saved.id)
    expect(fetched?.name).toBe('Memory Preset')

    await memoryStore.updatePreset(saved.id, { name: 'Renamed Memory' })
    const refetched = await memoryStore.getPreset(saved.id)
    expect(refetched?.name).toBe('Renamed Memory')

    await memoryStore.deletePreset(saved.id)
    expect(await memoryStore.listPresets()).toHaveLength(0)
  })
})

describe('Blob <-> Data URL conversions', () => {
  it('converts data URL to Blob and preserves MIME type', () => {
    const blob = dataUrlToBlob(SAMPLE_DATA_URL)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/png')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('converts Blob to base64 data URL', async () => {
    const blob = new Blob(['test content'], { type: 'text/plain' })
    const dataUrl = await blobToDataUrl(blob)
    expect(dataUrl.startsWith('data:text/plain;base64,')).toBe(true)
  })
})
