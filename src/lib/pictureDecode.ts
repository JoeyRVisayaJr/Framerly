import { calculateThumbnailSize, isHeicFile } from './batchIngest'
import type { Size } from './framing'
import { detectSubject, type FocalPoint } from './subjectDetection'

export interface DecodedPicture {
  name: string
  width: number
  height: number
  previewUrl: string
  focalPoint?: FocalPoint
}

interface BitmapLike {
  width: number
  height: number
  close?: () => void
}

export interface PictureDecodeDeps {
  convertHeic?: (file: File) => Promise<Blob>
  loadBitmap?: (blob: Blob) => Promise<BitmapLike>
  renderThumbnail?: (bitmap: BitmapLike, size: Size) => Promise<string>
  detectSubject?: (source: CanvasImageSource) => Promise<FocalPoint>
}

/** Convert an Apple HEIC/HEIF file in the browser with no server call. */
export async function convertHeicFile(file: File): Promise<Blob> {
  const { default: heic2any } = await import('heic2any')
  const converted = await heic2any({ blob: file, toType: 'image/png' })
  const blob = Array.isArray(converted) ? converted[0] : converted
  if (!(blob instanceof Blob)) {
    throw new Error(`Could not convert Picture ${file.name}`)
  }
  return blob
}

function loadBitmapDefault(blob: Blob): Promise<BitmapLike> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(blob) as Promise<BitmapLike>
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img as unknown as BitmapLike)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not decode picture'))
    }
    img.src = url
  })
}

function renderThumbnailDefault(bitmap: BitmapLike, size: Size): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return Promise.reject(new Error('2D canvas context is not available'))
  }
  ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, size.width, size.height)
  return Promise.resolve(canvas.toDataURL('image/jpeg', 0.82))
}

/**
 * Decode one Batch Picture into a lightweight ~800px preview with subject detection.
 * Full-resolution sources are released immediately to avoid OOM.
 */
export async function decodePictureFile(file: File, deps: PictureDecodeDeps = {}): Promise<DecodedPicture> {
  const convertHeic = deps.convertHeic ?? convertHeicFile
  const loadBitmap = deps.loadBitmap ?? loadBitmapDefault
  const renderThumbnail = deps.renderThumbnail ?? renderThumbnailDefault
  const detect = deps.detectSubject ?? detectSubject
  try {
    const source: Blob = isHeicFile(file) ? await convertHeic(file) : file
    const bitmap = await loadBitmap(source)
    try {
      const size = calculateThumbnailSize({ width: bitmap.width, height: bitmap.height })
      const previewUrl = await renderThumbnail(bitmap, size)
      let focalPoint: FocalPoint | undefined
      try {
        focalPoint = await detect(bitmap as unknown as CanvasImageSource)
      } catch {
        // Fall back to default focal point if detector fails
      }
      return { name: file.name, width: size.width, height: size.height, previewUrl, focalPoint }
    } finally {
      bitmap.close?.()
    }
  } catch {
    throw new Error(`Could not read Picture ${file.name}`)
  }
}
