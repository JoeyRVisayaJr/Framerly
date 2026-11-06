import { detectAperture } from '../aperture'
import type { ApertureRect } from '../framing'

const STORAGE_KEY = 'framerly.frame.v1'

export interface StoredFrame {
  /** PNG data URL for preview and persistence. */
  dataUrl: string
  width: number
  height: number
  /** Null when the Frame is opaque and needs manual Aperture Calibration. */
  aperture: ApertureRect | null
  /** The detected Aperture from transparency analysis, or null if opaque. */
  detectedAperture?: ApertureRect | null
  /** True when the Aperture has been manually calibrated or adjusted. */
  calibrated?: boolean
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
    (v.aperture === null || isValidAperture(v.aperture)) &&
    (v.detectedAperture === undefined ||
      v.detectedAperture === null ||
      isValidAperture(v.detectedAperture)) &&
    (v.calibrated === undefined || typeof v.calibrated === 'boolean')
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
    reader.onerror = () => reject(new Error(`Could not read Frame file ${file.name}`))
    reader.readAsDataURL(file)
  })
}

function loadFrameImage(dataUrl: string, name: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Could not decode Frame file ${name} as PNG`))
    img.src = dataUrl
  })
}

async function readHeaderBytes(file: File, length = 8): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    try {
      const buf = await file.arrayBuffer()
      return new Uint8Array(buf.slice(0, length))
    } catch {
      // Fall through to FileReader
    }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result).slice(0, length))
      } else {
        resolve(new Uint8Array(0))
      }
    }
    reader.onerror = () => reject(new Error(`Could not decode Frame file ${file.name} as PNG`))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Decode a user-supplied PNG Frame file: read it, measure it, and detect
 * its transparent Aperture on a canvas. Throws for non-PNG or corrupt files.
 */
export async function decodeFrameFile(file: File): Promise<StoredFrame> {
  if (!isPngFile(file)) {
    throw new Error(`Frame file ${file.name} must be a PNG file`)
  }
  try {
    const header = await readHeaderBytes(file, 8)
    const isPngHeader =
      header.length >= 8 &&
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47 &&
      header[4] === 0x0d &&
      header[5] === 0x0a &&
      header[6] === 0x1a &&
      header[7] === 0x0a
    if (!isPngHeader) {
      throw new Error(`Could not decode Frame file ${file.name} as PNG`)
    }
    const dataUrl = await readAsDataUrl(file)
    const img = await loadFrameImage(dataUrl, file.name)
    const width = img.naturalWidth
    const height = img.naturalHeight
    if (!width || !height) {
      throw new Error(`Could not decode Frame file ${file.name} as PNG`)
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

    return {
      dataUrl,
      width,
      height,
      aperture,
      detectedAperture: aperture,
      calibrated: false,
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes(file.name)) {
      throw err
    }
    throw new Error(`Could not decode Frame file ${file.name} as PNG`)
  }
}
