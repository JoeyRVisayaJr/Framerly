import { detectAperture } from './aperture'
import type { ApertureRect } from './framing'

const STORAGE_KEY = 'framerly.frame.v1'

export interface StoredFrame {
  /** PNG data URL for preview and persistence. */
  dataUrl: string
  width: number
  height: number
  /** Null when the Frame is opaque and needs manual Aperture Calibration. */
  aperture: ApertureRect | null
}

/** Accept PNG Frames by MIME type, falling back to the file extension. */
export function isPngFile(file: File): boolean {
  if (file.type === 'image/png') return true
  return file.name.toLowerCase().endsWith('.png')
}

function isValidStoredFrame(value: unknown): value is StoredFrame {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.dataUrl === 'string' &&
    v.dataUrl.startsWith('data:image/png') &&
    typeof v.width === 'number' &&
    v.width > 0 &&
    typeof v.height === 'number' &&
    v.height > 0 &&
    (v.aperture === null || isValidAperture(v.aperture))
  )
}

function isValidAperture(value: unknown): value is ApertureRect {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.x === 'number' &&
    typeof v.y === 'number' &&
    typeof v.width === 'number' &&
    v.width > 0 &&
    typeof v.height === 'number' &&
    v.height > 0
  )
}

/** Persist a decoded Frame in browser storage so it survives reloads. */
export function saveFrame(storage: Storage, frame: StoredFrame): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(frame))
}

/** Returns null when nothing is stored or the stored data is corrupt. */
export function loadFrame(storage: Storage): StoredFrame | null {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isValidStoredFrame(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Remove any persisted Frame from browser storage. */
export function clearFrame(storage: Storage): void {
  storage.removeItem(STORAGE_KEY)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read the Frame file'))
    reader.readAsDataURL(file)
  })
}

function loadFrameImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode the Frame file as PNG'))
    img.src = dataUrl
  })
}

/**
 * Decode a user-supplied PNG Frame file: read it, measure it, and detect
 * its transparent Aperture on a canvas. Throws for non-PNG or corrupt files.
 */
export async function decodeFrameFile(file: File): Promise<StoredFrame> {
  if (!isPngFile(file)) {
    throw new Error('Frame must be a PNG file')
  }
  const dataUrl = await readAsDataUrl(file)
  const img = await loadFrameImage(dataUrl)
  const width = img.naturalWidth
  const height = img.naturalHeight
  if (!width || !height) {
    throw new Error('Could not decode the Frame file as PNG')
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('2D canvas context is not available')
  }
  ctx.drawImage(img, 0, 0)
  const pixels = ctx.getImageData(0, 0, width, height)
  const aperture = detectAperture({
    width: pixels.width,
    height: pixels.height,
    data: pixels.data,
  })

  return { dataUrl, width, height, aperture }
}
