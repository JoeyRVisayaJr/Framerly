import { renderFramedPicture, type AdjustmentInput, type CropMode, type PictureSource, type Size } from './framing'
import type { StoredFrame } from './frameStore'
import { convertHeicFile } from './pictureDecode'
import { isHeicFile } from './batchIngest'
import { exportEncodeOptions, type PictureExportFormat } from './exportFormat'
import type { FocalPoint } from './subjectDetection'

export { EXPORT_JPEG_QUALITY } from './exportFormat'

interface BitmapLike {
  width: number
  height: number
  close?: () => void
}

export interface PictureExportDeps {
  loadBitmap?: (blob: Blob) => Promise<BitmapLike>
  convertHeic?: (file: File) => Promise<Blob>
  createCanvas?: (size: Size) => HTMLCanvasElement
  toBlob?: (canvas: HTMLCanvasElement, type: string, quality?: number) => Promise<Blob>
  loadFrameImage?: (dataUrl: string) => Promise<HTMLImageElement>
  triggerDownload?: (blob: Blob, filename: string) => void
  render?: typeof renderFramedPicture
}

export interface FramedPictureFileInput {
  file: File
  frame: StoredFrame
  cropMode?: CropMode
  focalPoint?: FocalPoint
  adjustment?: AdjustmentInput
  /** Output encoding. Defaults to high-quality JPEG. */
  format?: PictureExportFormat
}

export interface RenderedFramedPictureFile {
  blob: Blob
  filename: string
}

/**
 * Repeated single-Picture downloads of the same HEIC source would pay the
 * full in-browser conversion again on every click. The conversion promise is
 * cached per File object until it resolves; a failed conversion is dropped
 * from the cache so the next attempt can retry.
 */
const heicConversionCache = new WeakMap<File, Promise<Blob>>()

function convertHeicCached(file: File, convert: (file: File) => Promise<Blob>): Promise<Blob> {
  let converted = heicConversionCache.get(file)
  if (!converted) {
    converted = convert(file).catch((error) => {
      heicConversionCache.delete(file)
      throw error
    })
    heicConversionCache.set(file, converted)
  }
  return converted
}

/** Blob URLs must outlive the click task, or Firefox/Safari can cancel the download before it starts. */
const DOWNLOAD_URL_REVOKE_DELAY_MS = 10_000

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
      reject(new Error('Could not decode Picture'))
    }
    img.src = url
  })
}

function createCanvasDefault(size: Size): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  return canvas
}

function toBlobDefault(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode Framed Picture'))),
      type,
      quality,
    )
  })
}

function loadFrameImageDefault(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode the Frame'))
    img.src = dataUrl
  })
}

/**
 * Render one Picture as a full-resolution Framed Picture at the Frame's exact
 * pixel dimensions, applying the current Crop Mode and manual Adjustment.
 * This is the same rendering seam the Batch Export pipeline reuses.
 */
export async function renderFramedPictureFile(
  input: FramedPictureFileInput,
  deps: PictureExportDeps = {},
): Promise<RenderedFramedPictureFile> {
  const {
    loadBitmap = loadBitmapDefault,
    convertHeic = convertHeicFile,
    createCanvas = createCanvasDefault,
    toBlob = toBlobDefault,
    loadFrameImage = loadFrameImageDefault,
    render = renderFramedPicture,
  } = deps

  const source: Blob = isHeicFile(input.file)
    ? await convertHeicCached(input.file, convertHeic)
    : input.file
  const bitmap = await loadBitmap(source)
  try {
    const frameImage = await loadFrameImage(input.frame.dataUrl)
    const canvas = createCanvas({ width: input.frame.width, height: input.frame.height })
    render(canvas, {
      picture: bitmap as unknown as PictureSource,
      frame: frameImage,
      aperture: input.frame.aperture ?? undefined,
      cropMode: input.cropMode,
      focalPoint: input.focalPoint,
      adjustment: input.adjustment,
    })
    const encode = exportEncodeOptions(input.format ?? 'jpeg')
    const blob = await toBlob(canvas, encode.type, encode.quality)
    return { blob, filename: input.file.name }
  } finally {
    bitmap.close?.()
  }
}

/** Trigger a browser download for a rendered blob under the Picture's original filename. */
export function triggerDownloadDefault(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoking in the same task as the click can cancel the download in
  // Firefox/Safari; give the browser time to start fetching the URL first.
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_REVOKE_DELAY_MS)
}

/**
 * Render one Picture at full resolution and download it immediately under its
 * original filename. Rejects on any failure so the caller can report it.
 */
export async function downloadFramedPicture(
  input: FramedPictureFileInput,
  deps: PictureExportDeps = {},
): Promise<void> {
  const { triggerDownload = triggerDownloadDefault } = deps
  const { blob, filename } = await renderFramedPictureFile(input, deps)
  triggerDownload(blob, filename)
}
