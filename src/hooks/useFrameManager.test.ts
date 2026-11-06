import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useFrameManager } from './useFrameManager'
import {
  createFramePresetStore,
  saveFrame,
  type StoredFrame,
} from '../lib/storage'
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb'

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
  calibrated: false,
}

describe('useFrameManager', () => {
  let storage: Storage
  let presetStore: ReturnType<typeof createFramePresetStore>

  beforeEach(async () => {
    storage = memoryStorage()
    presetStore = createFramePresetStore(fakeIndexedDB)
    await presetStore.clear()
  })

  it('restores presets from presetStore on mount', async () => {
    const saved = await presetStore.savePreset({
      name: 'Event 2026',
      width: 1000,
      height: 1000,
      aperture: { x: 50, y: 50, width: 900, height: 900 },
      blob: new Blob(['x'], { type: 'image/png' }),
      dataUrl: sampleFrame.dataUrl,
    })

    const { result } = renderHook(() => useFrameManager({ storage, presetStore }))

    await waitFor(() => {
      expect(result.current.presets).toHaveLength(1)
      expect(result.current.frame?.width).toBe(1000)
      expect(result.current.activePresetId).toBe(saved.id)
    })
  })

  it('migrates legacy localStorage Frame if presetStore is empty', async () => {
    saveFrame(storage, sampleFrame)

    const { result } = renderHook(() => useFrameManager({ storage, presetStore }))

    await waitFor(() => {
      expect(result.current.frame?.width).toBe(sampleFrame.width)
      expect(result.current.presets).toHaveLength(1)
    })
  })

  it('switches active Frame when handleSelectPreset is called', async () => {
    await presetStore.savePreset({
      name: 'Preset 1',
      width: 100,
      height: 100,
      aperture: null,
      blob: new Blob(['x'], { type: 'image/png' }),
    })
    const preset2 = await presetStore.savePreset({
      name: 'Preset 2',
      width: 200,
      height: 200,
      aperture: null,
      blob: new Blob(['y'], { type: 'image/png' }),
    })

    const { result } = renderHook(() => useFrameManager({ storage, presetStore }))

    await waitFor(() => expect(result.current.presets).toHaveLength(2))

    act(() => {
      result.current.handleSelectPreset(preset2.id)
    })

    expect(result.current.activePresetId).toBe(preset2.id)
    expect(result.current.frame?.width).toBe(200)
  })

  it('renames a Frame Preset', async () => {
    const preset = await presetStore.savePreset({
      name: 'Old Name',
      width: 300,
      height: 300,
      aperture: null,
      blob: new Blob(['x'], { type: 'image/png' }),
    })

    const { result } = renderHook(() => useFrameManager({ storage, presetStore }))
    await waitFor(() => expect(result.current.presets).toHaveLength(1))

    await act(async () => {
      await result.current.handleRenamePreset(preset.id, 'New Name')
    })

    expect(result.current.presets[0].name).toBe('New Name')
  })

  it('deletes a Frame Preset and switches to fallback if active', async () => {
    const p1 = await presetStore.savePreset({
      name: 'P1',
      width: 100,
      height: 100,
      aperture: null,
      blob: new Blob(['x'], { type: 'image/png' }),
    })
    const p2 = await presetStore.savePreset({
      name: 'P2',
      width: 200,
      height: 200,
      aperture: null,
      blob: new Blob(['y'], { type: 'image/png' }),
    })

    const { result } = renderHook(() => useFrameManager({ storage, presetStore }))
    await waitFor(() => expect(result.current.presets).toHaveLength(2))

    expect(result.current.activePresetId).toBe(p1.id)

    await act(async () => {
      await result.current.handleDeletePreset(p1.id)
    })

    expect(result.current.presets).toHaveLength(1)
    expect(result.current.activePresetId).toBe(p2.id)
    expect(result.current.frame?.width).toBe(200)
  })

  it('calibrates aperture on active Frame and updates preset', async () => {
    await presetStore.savePreset({
      name: 'Calibrate Target',
      width: 500,
      height: 500,
      aperture: null,
      blob: new Blob(['x'], { type: 'image/png' }),
      dataUrl: sampleFrame.dataUrl,
    })

    const { result } = renderHook(() => useFrameManager({ storage, presetStore }))
    await waitFor(() => expect(result.current.presets).toHaveLength(1))

    const newAperture = { x: 50, y: 50, width: 400, height: 400 }

    act(() => {
      result.current.handleCalibrate(newAperture)
    })

    expect(result.current.frame?.aperture).toEqual(newAperture)
    expect(result.current.frame?.calibrated).toBe(true)
  })

  it('rejects non-PNG files with error', async () => {
    const { result } = renderHook(() => useFrameManager({ storage, presetStore }))
    const badFile = new File(['x'], 'picture.jpg', { type: 'image/jpeg' })

    await act(async () => {
      await result.current.handleSelect(badFile)
    })

    expect(result.current.error).toContain('must be a PNG file')
  })

  it('clears active Frame', async () => {
    saveFrame(storage, sampleFrame)
    const { result } = renderHook(() => useFrameManager({ storage, presetStore }))
    await waitFor(() => expect(result.current.frame).not.toBeNull())

    act(() => {
      result.current.handleClear()
    })

    expect(result.current.frame).toBeNull()
    expect(result.current.activePresetId).toBeNull()
  })
})
