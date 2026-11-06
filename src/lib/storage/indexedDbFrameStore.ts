import type { ApertureRect } from '../framing'

const DB_NAME = 'framerly-frame-presets'
const STORE_NAME = 'presets'
const DB_VERSION = 1

/**
 * A persistent Frame Preset record stored in the Frame Preset Library.
 */
export interface FramePreset {
  /** Unique identifier for this Frame Preset. */
  id: string
  /** Human-readable display name (e.g. "Gala 2026 - Story 9:16"). */
  name: string
  /** Frame width in pixels. */
  width: number
  /** Frame height in pixels. */
  height: number
  /** The active Aperture for framing event Pictures, or null if uncalibrated. */
  aperture: ApertureRect | null
  /** The original detected Aperture from transparency analysis, or null if opaque. */
  detectedAperture?: ApertureRect | null
  /** True when the Aperture has been manually calibrated or adjusted. */
  calibrated: boolean
  /** Creation timestamp in milliseconds since epoch. */
  createdAt: number
  /** High-resolution PNG Frame binary Blob. */
  blob: Blob
  /** PNG data URL for preview rendering and compositing. */
  dataUrl: string
}

/**
 * Input fields required to create or save a new Frame Preset.
 */
export interface FramePresetInput {
  /** Optional custom ID; generated automatically when omitted. */
  id?: string
  /** Descriptive name; defaults to dimension label when omitted. */
  name?: string
  /** Frame pixel width. */
  width: number
  /** Frame pixel height. */
  height: number
  /** Initial Aperture rectangle, or null if uncalibrated. */
  aperture: ApertureRect | null
  /** Detected Aperture rectangle from transparency analysis. */
  detectedAperture?: ApertureRect | null
  /** Whether the Aperture is calibrated. Defaults to false. */
  calibrated?: boolean
  /** Timestamp when created. Defaults to Date.now(). */
  createdAt?: number
  /** High-resolution PNG Frame binary Blob. */
  blob: Blob
  /** Optional pre-computed data URL. Generated from blob when omitted. */
  dataUrl?: string
}

/**
 * Interface for Frame Preset storage engines (IndexedDB or in-memory fallback).
 */
export interface FramePresetStore {
  /** Returns true if IndexedDB is active, false if operating in fallback memory. */
  isAvailable(): boolean
  /** Lists all saved Frame Presets, sorted by creation date ascending. */
  listPresets(): Promise<FramePreset[]>
  /** Retrieves a single Frame Preset by ID, or null if not found. */
  getPreset(id: string): Promise<FramePreset | null>
  /** Saves a new Frame Preset entry and returns the stored record. */
  savePreset(input: FramePresetInput): Promise<FramePreset>
  /** Updates mutable properties (name, aperture, calibrated) of an existing Frame Preset. */
  updatePreset(
    id: string,
    updates: Partial<Pick<FramePreset, 'name' | 'aperture' | 'calibrated' | 'dataUrl' | 'blob'>>,
  ): Promise<FramePreset>
  /** Deletes a Frame Preset record and its associated binary blob. */
  deletePreset(id: string): Promise<void>
  /** Clears all stored Frame Presets. */
  clear(): Promise<void>
}

/**
 * Converts a base64 data URL into a binary Blob.
 *
 * @param dataUrl - The data URL string to convert.
 * @returns The converted Blob with detected MIME type.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',')
  const mimeMatch = parts[0]?.match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  const bstr = atob(parts[1] || '')
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

/**
 * Converts a binary Blob into a base64 data URL string.
 *
 * @param blob - The binary Blob to convert.
 * @returns A promise resolving to the data URL string.
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof blob.arrayBuffer === 'function') {
    try {
      const buffer = await blob.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      const chunkSize = 0x8000
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
      }
      const base64 = btoa(binary)
      const mime = blob.type || 'image/png'
      return `data:${mime};base64,${base64}`
    } catch {
      // Fall through to FileReader below
    }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read Blob as data URL'))
    reader.readAsDataURL(blob)
  })
}

let lastTimestamp = 0
function monotonicNow(): number {
  const now = Date.now()
  lastTimestamp = now > lastTimestamp ? now : lastTimestamp + 1
  return lastTimestamp
}

function generatePresetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function defaultPresetName(width: number, height: number): string {
  return `Frame ${width} x ${height}`
}

interface StoredPresetRecord {
  id: string
  name: string
  width: number
  height: number
  aperture: ApertureRect | null
  detectedAperture?: ApertureRect | null
  calibrated: boolean
  createdAt: number
  blob: Blob
  dataUrl?: string
}

function toFramePreset(record: StoredPresetRecord, dataUrl: string): FramePreset {
  let blob = record.blob
  if (!blob || typeof blob.size !== 'number') {
    if (dataUrl) {
      blob = dataUrlToBlob(dataUrl)
    }
  }
  return {
    ...record,
    blob,
    dataUrl,
  }
}

class InMemoryPresetStore implements FramePresetStore {
  private records = new Map<string, StoredPresetRecord>()

  isAvailable(): boolean {
    return false
  }

  async listPresets(): Promise<FramePreset[]> {
    const list: FramePreset[] = []
    const sorted = [...this.records.values()].sort((a, b) =>
      a.createdAt !== b.createdAt ? a.createdAt - b.createdAt : a.id.localeCompare(b.id),
    )
    for (const record of sorted) {
      const dataUrl = record.dataUrl ?? (await blobToDataUrl(record.blob))
      list.push(toFramePreset(record, dataUrl))
    }
    return list
  }

  async getPreset(id: string): Promise<FramePreset | null> {
    const record = this.records.get(id)
    if (!record) return null
    const dataUrl = record.dataUrl ?? (await blobToDataUrl(record.blob))
    return toFramePreset(record, dataUrl)
  }

  async savePreset(input: FramePresetInput): Promise<FramePreset> {
    const id = input.id ?? generatePresetId()
    const name = input.name?.trim() || defaultPresetName(input.width, input.height)
    const createdAt = input.createdAt ?? monotonicNow()
    const calibrated = input.calibrated ?? false
    const dataUrl = input.dataUrl ?? (await blobToDataUrl(input.blob))

    const record: StoredPresetRecord = {
      id,
      name,
      width: input.width,
      height: input.height,
      aperture: input.aperture,
      detectedAperture: input.detectedAperture ?? input.aperture,
      calibrated,
      createdAt,
      blob: input.blob,
      dataUrl,
    }

    this.records.set(id, record)
    return toFramePreset(record, dataUrl)
  }

  async updatePreset(
    id: string,
    updates: Partial<Pick<FramePreset, 'name' | 'aperture' | 'calibrated' | 'dataUrl' | 'blob'>>,
  ): Promise<FramePreset> {
    const existing = this.records.get(id)
    if (!existing) {
      throw new Error(`Frame Preset with ID ${id} not found`)
    }

    const updated: StoredPresetRecord = {
      ...existing,
      ...updates,
      name: updates.name !== undefined ? updates.name.trim() || existing.name : existing.name,
    }

    this.records.set(id, updated)
    const dataUrl = updated.dataUrl ?? (await blobToDataUrl(updated.blob))
    return toFramePreset(updated, dataUrl)
  }

  async deletePreset(id: string): Promise<void> {
    this.records.delete(id)
  }

  async clear(): Promise<void> {
    this.records.clear()
  }
}

class IndexedDbPresetStore implements FramePresetStore {
  private idbFactory: IDBFactory
  private dbPromise: Promise<IDBDatabase> | null = null
  private fallbackStore: InMemoryPresetStore | null = null

  constructor(idbFactory: IDBFactory) {
    this.idbFactory = idbFactory
  }

  isAvailable(): boolean {
    return this.fallbackStore === null
  }

  private async getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      try {
        const req = this.idbFactory.open(DB_NAME, DB_VERSION)

        req.onupgradeneeded = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          }
        }

        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'))
      } catch (err) {
        reject(err)
      }
    })

    return this.dbPromise
  }

  private async runWithFallback<T>(
    operation: (db: IDBDatabase) => Promise<T>,
    fallbackOp: (fallback: InMemoryPresetStore) => Promise<T>,
  ): Promise<T> {
    if (this.fallbackStore) {
      return fallbackOp(this.fallbackStore)
    }

    try {
      const db = await this.getDb()
      return await operation(db)
    } catch {
      if (!this.fallbackStore) {
        this.fallbackStore = new InMemoryPresetStore()
      }
      return fallbackOp(this.fallbackStore)
    }
  }

  async listPresets(): Promise<FramePreset[]> {
    return this.runWithFallback(
      async (db) => {
        return new Promise<FramePreset[]>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly')
          const store = tx.objectStore(STORE_NAME)
          const req = store.getAll()

          req.onsuccess = async () => {
            const records: StoredPresetRecord[] = req.result || []
            records.sort((a, b) =>
              a.createdAt !== b.createdAt ? a.createdAt - b.createdAt : a.id.localeCompare(b.id),
            )
            try {
              const presets = await Promise.all(
                records.map(async (record) => {
                  const dataUrl = record.dataUrl ?? (await blobToDataUrl(record.blob))
                  return toFramePreset(record, dataUrl)
                }),
              )
              resolve(presets)
            } catch (err) {
              reject(err)
            }
          }
          req.onerror = () => reject(req.error)
        })
      },
      (fallback) => fallback.listPresets(),
    )
  }

  async getPreset(id: string): Promise<FramePreset | null> {
    return this.runWithFallback(
      async (db) => {
        return new Promise<FramePreset | null>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly')
          const store = tx.objectStore(STORE_NAME)
          const req = store.get(id)

          req.onsuccess = async () => {
            const record: StoredPresetRecord | undefined = req.result
            if (!record) {
              resolve(null)
              return
            }
            try {
              const dataUrl = record.dataUrl ?? (await blobToDataUrl(record.blob))
              resolve(toFramePreset(record, dataUrl))
            } catch (err) {
              reject(err)
            }
          }
          req.onerror = () => reject(req.error)
        })
      },
      (fallback) => fallback.getPreset(id),
    )
  }

  async savePreset(input: FramePresetInput): Promise<FramePreset> {
    return this.runWithFallback(
      async (db) => {
        const id = input.id ?? generatePresetId()
        const name = input.name?.trim() || defaultPresetName(input.width, input.height)
        const createdAt = input.createdAt ?? monotonicNow()
        const calibrated = input.calibrated ?? false
        const dataUrl = input.dataUrl ?? (await blobToDataUrl(input.blob))

        const record: StoredPresetRecord = {
          id,
          name,
          width: input.width,
          height: input.height,
          aperture: input.aperture,
          detectedAperture: input.detectedAperture ?? input.aperture,
          calibrated,
          createdAt,
          blob: input.blob,
          dataUrl,
        }

        return new Promise<FramePreset>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          const store = tx.objectStore(STORE_NAME)
          const req = store.put(record)

          req.onsuccess = () => resolve(toFramePreset(record, dataUrl))
          req.onerror = () => reject(req.error)
        })
      },
      (fallback) => fallback.savePreset(input),
    )
  }

  async updatePreset(
    id: string,
    updates: Partial<Pick<FramePreset, 'name' | 'aperture' | 'calibrated' | 'dataUrl' | 'blob'>>,
  ): Promise<FramePreset> {
    return this.runWithFallback(
      async (db) => {
        const existing = await this.getPreset(id)
        if (!existing) {
          throw new Error(`Frame Preset with ID ${id} not found`)
        }

        const updatedRecord: StoredPresetRecord = {
          id: existing.id,
          name: updates.name !== undefined ? updates.name.trim() || existing.name : existing.name,
          width: existing.width,
          height: existing.height,
          aperture: updates.aperture !== undefined ? updates.aperture : existing.aperture,
          detectedAperture: existing.detectedAperture,
          calibrated: updates.calibrated !== undefined ? updates.calibrated : existing.calibrated,
          createdAt: existing.createdAt,
          blob: updates.blob ?? existing.blob,
          dataUrl: updates.dataUrl ?? existing.dataUrl,
        }

        return new Promise<FramePreset>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          const store = tx.objectStore(STORE_NAME)
          const req = store.put(updatedRecord)

          req.onsuccess = async () => {
            const dataUrl =
              updatedRecord.dataUrl ?? (await blobToDataUrl(updatedRecord.blob))
            resolve(toFramePreset(updatedRecord, dataUrl))
          }
          req.onerror = () => reject(req.error)
        })
      },
      (fallback) => fallback.updatePreset(id, updates),
    )
  }

  async deletePreset(id: string): Promise<void> {
    return this.runWithFallback(
      async (db) => {
        return new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          const store = tx.objectStore(STORE_NAME)
          const req = store.delete(id)

          req.onsuccess = () => resolve()
          req.onerror = () => reject(req.error)
        })
      },
      (fallback) => fallback.deletePreset(id),
    )
  }

  async clear(): Promise<void> {
    return this.runWithFallback(
      async (db) => {
        return new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          const store = tx.objectStore(STORE_NAME)
          const req = store.clear()

          req.onsuccess = () => resolve()
          req.onerror = () => reject(req.error)
        })
      },
      (fallback) => fallback.clear(),
    )
  }
}

/**
 * Creates a FramePresetStore backed by IndexedDB, or an in-memory fallback
 * when IndexedDB is unavailable or access is denied.
 *
 * @param customIndexedDb - Optional custom IDBFactory instance (e.g. for testing).
 * @returns An initialized FramePresetStore instance.
 */
export function createFramePresetStore(customIndexedDb?: IDBFactory | null): FramePresetStore {
  const idb =
    customIndexedDb !== undefined
      ? customIndexedDb
      : typeof window !== 'undefined'
        ? window.indexedDB
        : null

  if (!idb) {
    return new InMemoryPresetStore()
  }

  return new IndexedDbPresetStore(idb)
}

/** Default singleton Frame Preset storage engine. */
export const defaultFramePresetStore: FramePresetStore = createFramePresetStore()
