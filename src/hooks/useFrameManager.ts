import { useCallback, useEffect, useState } from 'react'
import type { ApertureRect } from '../lib/framing'
import {
  clearFrame,
  dataUrlToBlob,
  decodeFrameFile,
  defaultFramePresetStore,
  isPngFile,
  loadFrame,
  saveFrame,
  type FramePreset,
  type FramePresetStore,
  type StoredFrame,
} from '../lib/storage'

export interface UseFrameManagerOptions {
  /** Storage backend for active Frame caching. Defaults to window.localStorage. */
  storage?: Storage
  /** Frame Preset Library store. Defaults to defaultFramePresetStore. */
  presetStore?: FramePresetStore
}

export interface UseFrameManagerResult {
  /** The currently active Frame, or null if none is selected. */
  frame: StoredFrame | null
  /** Available Frame Presets in the library. */
  presets: FramePreset[]
  /** ID of the active Frame Preset, or null if unassigned. */
  activePresetId: string | null
  /** True while decoding or persisting a Frame file. */
  loading: boolean
  /** Error message from Frame decode, preset update, or deletion. */
  error: string | null
  /** Clears the current Frame error message. */
  clearError: () => void
  /** Ingests, decodes, and persists a user-supplied Frame PNG file. */
  handleSelect: (file: File, optionalName?: string) => Promise<void>
  /** Selects an existing Frame Preset from the library as active. */
  handleSelectPreset: (presetId: string) => void
  /** Renames an existing Frame Preset record. */
  handleRenamePreset: (presetId: string, newName: string) => Promise<void>
  /** Deletes a Frame Preset record and switches active Frame if necessary. */
  handleDeletePreset: (presetId: string) => Promise<void>
  /** Clears the active Frame and resets active preset selection. */
  handleClear: () => void
  /** Updates the active Frame with a manually calibrated Aperture. */
  handleCalibrate: (calibratedAperture: ApertureRect) => void
}

/**
 * Manages Frame selection, Aperture Calibration, and persistent Frame Presets.
 */
export function useFrameManager(options: UseFrameManagerOptions = {}): UseFrameManagerResult {
  const {
    storage = typeof window !== 'undefined' ? window.localStorage : undefined,
    presetStore = defaultFramePresetStore,
  } = options

  const [presets, setPresets] = useState<FramePreset[]>([])
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  const [frame, setFrame] = useState<StoredFrame | null>(() => {
    if (storage) return loadFrame(storage)
    return null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const storedPresets = await presetStore.listPresets()
        if (cancelled) return
        if (storedPresets.length > 0) {
          setPresets(storedPresets)
          setActivePresetId(storedPresets[0].id)
          setFrame(storedPresets[0])
          return
        }
      } catch {
        // Fall back to legacy localStorage
      }

      if (!storage) return
      const legacy = loadFrame(storage)
      if (legacy && !cancelled) {
        setFrame(legacy)
        try {
          const blob = dataUrlToBlob(legacy.dataUrl)
          const saved = await presetStore.savePreset({
            name: `Frame ${legacy.width} x ${legacy.height}`,
            width: legacy.width,
            height: legacy.height,
            aperture: legacy.aperture,
            detectedAperture: legacy.detectedAperture,
            calibrated: legacy.calibrated,
            blob,
            dataUrl: legacy.dataUrl,
          })
          if (!cancelled) {
            setPresets([saved])
            setActivePresetId(saved.id)
          }
        } catch {
          // Ignore legacy migration error
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [presetStore, storage])

  const handleSelect = useCallback(
    async (file: File, optionalName?: string) => {
      if (!isPngFile(file)) {
        setError(`Frame file ${file.name} must be a PNG file`)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const decoded = await decodeFrameFile(file)
        const baseName = file.name.replace(/\.[^/.]+$/, '')
        const presetName =
          optionalName?.trim() || baseName || `Frame ${decoded.width} x ${decoded.height}`

        const savedPreset = await presetStore.savePreset({
          name: presetName,
          width: decoded.width,
          height: decoded.height,
          aperture: decoded.aperture,
          detectedAperture: decoded.detectedAperture,
          calibrated: decoded.calibrated,
          blob: file,
          dataUrl: decoded.dataUrl,
        })

        setPresets((current) => [...current.filter((p) => p.id !== savedPreset.id), savedPreset])
        setActivePresetId(savedPreset.id)
        setFrame(savedPreset)

        if (storage) {
          try {
            saveFrame(storage, savedPreset)
          } catch {
            // Ignore localStorage quota warnings since IndexedDB holds the high-res preset safely
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : `Could not decode Frame file ${file.name} as PNG`)
      } finally {
        setLoading(false)
      }
    },
    [presetStore, storage],
  )

  const handleSelectPreset = useCallback(
    (presetId: string) => {
      const target = presets.find((p) => p.id === presetId)
      if (target) {
        setActivePresetId(target.id)
        setFrame(target)
        if (storage) {
          try {
            saveFrame(storage, target)
          } catch {
            // Ignore localStorage quota errors
          }
        }
      }
    },
    [presets, storage],
  )

  const handleRenamePreset = useCallback(
    async (presetId: string, newName: string) => {
      try {
        const updated = await presetStore.updatePreset(presetId, { name: newName })
        setPresets((current) => current.map((p) => (p.id === presetId ? updated : p)))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not rename Frame Preset')
      }
    },
    [presetStore],
  )

  const handleDeletePreset = useCallback(
    async (presetId: string) => {
      try {
        await presetStore.deletePreset(presetId)
        setPresets((current) => {
          const next = current.filter((p) => p.id !== presetId)
          if (activePresetId === presetId) {
            if (next.length > 0) {
              setActivePresetId(next[0].id)
              setFrame(next[0])
            } else {
              setActivePresetId(null)
              setFrame(null)
              if (storage) clearFrame(storage)
            }
          }
          return next
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not delete Frame Preset')
      }
    },
    [activePresetId, presetStore, storage],
  )

  const handleClear = useCallback(() => {
    if (storage) clearFrame(storage)
    setActivePresetId(null)
    setFrame(null)
    setError(null)
  }, [storage])

  const handleCalibrate = useCallback(
    (calibratedAperture: ApertureRect) => {
      setFrame((current) => {
        if (!current) return null
        const updated: StoredFrame = {
          ...current,
          aperture: calibratedAperture,
          calibrated: true,
        }
        if (storage) {
          try {
            saveFrame(storage, updated)
          } catch {
            // Ignore localStorage quota warning
          }
        }
        return updated
      })

      if (activePresetId) {
        void presetStore
          .updatePreset(activePresetId, {
            aperture: calibratedAperture,
            calibrated: true,
          })
          .then((updated) => {
            setPresets((current) => current.map((p) => (p.id === activePresetId ? updated : p)))
          })
      }
    },
    [activePresetId, presetStore, storage],
  )

  return {
    frame,
    presets,
    activePresetId,
    loading,
    error,
    clearError,
    handleSelect,
    handleSelectPreset,
    handleRenamePreset,
    handleDeletePreset,
    handleClear,
    handleCalibrate,
  }
}
