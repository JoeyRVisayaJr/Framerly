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
      name: 'Square 1:1',
      width: 1080,
      height: 1080,
      aperture: { x: 100, y: 100, width: 880, height: 880 },
      detectedAperture: { x: 100, y: 100, width: 880, height: 880 },
      calibrated: false,
      blob: makeSampleBlob(),
      dataUrl: SAMPLE_DATA_URL,
    }

    const saved = await store.savePreset(input)
    expect(saved.id).toBeDefined()
    expect(saved.name).toBe('Square 1:1')
    expect(saved.width).toBe(1080)
    expect(saved.height).toBe(1080)
    expect(saved.aperture).toEqual({ x: 100, y: 100, width: 880, height: 880 })
    expect(saved.calibrated).toBe(false)
    expect(saved.createdAt).toBeTypeOf('number')

    const list = await store.listPresets()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(saved.id)
    expect(list[0].name).toBe('Square 1:1')
  })

  it('retrieves a Frame Preset by id', async () => {
    const saved = await store.savePreset({
      name: 'Story 9:16',
      width: 1080,
      height: 1920,
      aperture: { x: 120, y: 200, width: 840, height: 1260 },
      blob: makeSampleBlob(),
      dataUrl: SAMPLE_DATA_URL,
    })

    const retrieved = await store.getPreset(saved.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved?.id).toBe(saved.id)
    expect(retrieved?.name).toBe('Story 9:16')
    expect(retrieved?.blob.size).toBe(64)
  })

  it('updates a Frame Preset (rename and aperture update)', async () => {
    const saved = await store.savePreset({
      name: 'Initial Name',
      width: 1920,
      height: 1080,
      aperture: null,
      blob: makeSampleBlob(),
      dataUrl: SAMPLE_DATA_URL,
    })

    const updated = await store.updatePreset(saved.id, {
      name: 'Gala 2026 - Story 9:16',
      aperture: { x: 200, y: 100, width: 1520, height: 880 },
      calibrated: true,
    })

    expect(updated.name).toBe('Gala 2026 - Story 9:16')
    expect(updated.calibrated).toBe(true)
    expect(updated.aperture).toEqual({ x: 200, y: 100, width: 1520, height: 880 })

    const reloaded = await store.getPreset(saved.id)
    expect(reloaded?.name).toBe('Gala 2026 - Story 9:16')
    expect(reloaded?.calibrated).toBe(true)
  })

  it('deletes a Frame Preset removing its record and blob', async () => {
    const saved = await store.savePreset({
      name: 'To Delete',
      width: 500,
      height: 500,
      aperture: null,
      blob: makeSampleBlob(),
      dataUrl: SAMPLE_DATA_URL,
    })

    expect(await store.listPresets()).toHaveLength(1)
    await store.deletePreset(saved.id)
    expect(await store.listPresets()).toHaveLength(0)
    expect(await store.getPreset(saved.id)).toBeNull()
  })

  it('stores large multi-megabyte PNG Frame blobs without failure', async () => {
    // 6 Megabytes blob
    const largeBlob = new Blob([new Uint8Array(6 * 1024 * 1024)], { type: 'image/png' })
    const saved = await store.savePreset({
      name: 'High-Res Print Frame',
      width: 3840,
      height: 2160,
      aperture: { x: 400, y: 200, width: 3040, height: 1760 },
      blob: largeBlob,
      dataUrl: SAMPLE_DATA_URL,
    })

    const retrieved = await store.getPreset(saved.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved?.blob.size).toBe(6 * 1024 * 1024)
  })

  it('assigns a default descriptive name if none is provided', async () => {
    const saved = await store.savePreset({
      width: 1200,
      height: 800,
      aperture: null,
      blob: makeSampleBlob(),
      dataUrl: SAMPLE_DATA_URL,
    })

    expect(saved.name).toContain('1200 x 800')
  })
})

describe('indexedDbFrameStore (In-memory fallback)', () => {
  it('falls back to ephemeral in-memory storage when IndexedDB is unavailable', async () => {
    // Passing null forces in-memory fallback
    const memoryStore = createFramePresetStore(null)

    const saved = await memoryStore.savePreset({
      name: 'Fallback Preset',
      width: 1000,
      height: 1000,
      aperture: null,
      blob: makeSampleBlob(),
      dataUrl: SAMPLE_DATA_URL,
    })

    expect(saved.id).toBeDefined()
    const list = await memoryStore.listPresets()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Fallback Preset')

    await memoryStore.updatePreset(saved.id, { name: 'Updated Fallback' })
    const retrieved = await memoryStore.getPreset(saved.id)
    expect(retrieved?.name).toBe('Updated Fallback')

    await memoryStore.deletePreset(saved.id)
    expect(await memoryStore.listPresets()).toHaveLength(0)
  })

  it('falls back to ephemeral in-memory storage when IndexedDB.open throws', async () => {
    const brokenIdb = {
      open: () => {
        throw new Error('Access denied')
      },
    } as unknown as IDBFactory

    const store = createFramePresetStore(brokenIdb)
    const saved = await store.savePreset({
      name: 'Safe Preset',
      width: 800,
      height: 600,
      aperture: null,
      blob: makeSampleBlob(),
      dataUrl: SAMPLE_DATA_URL,
    })

    expect(saved.name).toBe('Safe Preset')
    expect(await store.listPresets()).toHaveLength(1)
  })
})

describe('blobToDataUrl and dataUrlToBlob utilities', () => {
  it('converts a data URL to a Blob and back', async () => {
    const blob = dataUrlToBlob(SAMPLE_DATA_URL)
    expect(blob.type).toBe('image/png')
    expect(blob.size).toBeGreaterThan(0)

    const convertedDataUrl = await blobToDataUrl(blob)
    expect(convertedDataUrl).toBe(SAMPLE_DATA_URL)
  })
})
