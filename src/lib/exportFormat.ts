/** Image format used for exported Framed Pictures. */
export type PictureExportFormat = 'jpeg' | 'png'

/** JPEG quality for single-Picture and Batch exports. */
export const EXPORT_JPEG_QUALITY = 0.92

/** MIME type written to the exported Blob for each format. */
export const EXPORT_MIME: Record<PictureExportFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
}

/** Canvas encode options for one export format (PNG is lossless and takes no quality). */
export function exportEncodeOptions(format: PictureExportFormat): {
  type: string
  quality?: number
} {
  return format === 'jpeg'
    ? { type: EXPORT_MIME.jpeg, quality: EXPORT_JPEG_QUALITY }
    : { type: EXPORT_MIME.png }
}
