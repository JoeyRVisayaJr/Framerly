import type { ApertureRect } from './framing'

export interface PixelData {
  width: number
  height: number
  /** Flat RGBA bytes, row-major, length must equal width * height * 4. */
  data: Uint8ClampedArray
}

/** Alpha below this is treated as transparent (fully open by default). */
export const DEFAULT_ALPHA_THRESHOLD = 16

/**
 * Find the bounding box of the transparent Aperture in a Frame's pixel data.
 * Returns null when the Frame is opaque (or has only single-pixel noise),
 * so callers can fall back to manual Aperture Calibration.
 */
export function detectAperture(
  pixels: PixelData,
  threshold: number = DEFAULT_ALPHA_THRESHOLD,
): ApertureRect | null {
  const { width, height, data } = pixels
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    data.length !== width * height * 4
  ) {
    throw new Error('Pixel data dimensions do not match the byte length')
  }

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha < threshold) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX === -1) return null

  const boxWidth = maxX - minX + 1
  const boxHeight = maxY - minY + 1
  // Single-pixel or single-line transparency is noise, not an Aperture.
  if (boxWidth < 2 || boxHeight < 2) return null

  return { x: minX, y: minY, width: boxWidth, height: boxHeight }
}
