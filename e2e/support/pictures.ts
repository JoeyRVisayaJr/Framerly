import type { Page } from '@playwright/test'

/**
 * Browser-side test fixtures for the e2e suite. Fixtures are drawn in the
 * page canvas instead of committed binary files, so the Aperture detection
 * and the Framed Picture rendering run against real PNG bytes.
 */

export interface FrameShape {
  /** Frame pixel dimensions. */
  width: number
  height: number
  /** Transparent rectangle that becomes the Aperture. */
  aperture: { x: number; y: number; width: number; height: number }
}

/** Solid colour used outside the Aperture, sampled by name in the tests. */
export const FRAME_COLOR = [20, 20, 20] as const

export type PicturePattern = 'red-and-blue' | 'solid-green'

/**
 * Create a Frame PNG in the page canvas: fully coloured except for the
 * transparent Aperture rectangle the engine detects as the opening.
 */
export async function makeFramePng(
  page: Page,
  frame: FrameShape,
): Promise<Buffer> {
  const base64 = await page.evaluate(
    ({ width, height, aperture }) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('2D canvas context is not available')
      ctx.fillStyle = 'rgb(20, 20, 20)'
      ctx.fillRect(0, 0, width, height)
      ctx.clearRect(aperture.x, aperture.y, aperture.width, aperture.height)
      return new Promise<string>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Could not encode the Frame PNG'))
            return
          }
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = String(reader.result)
            resolve(dataUrl.slice(dataUrl.indexOf(',') + 1))
          }
          reader.onerror = () => reject(new Error('Could not read the Frame blob'))
          reader.readAsDataURL(blob)
        }, 'image/png')
      })
    },
    frame,
  )
  return Buffer.from(base64, 'base64')
}

/**
 * Create a completely opaque Frame PNG with no transparent regions.
 */
export async function makeOpaqueFramePng(
  page: Page,
  size: { width: number; height: number },
): Promise<Buffer> {
  const base64 = await page.evaluate(
    ({ width, height }) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('2D canvas context is not available')
      ctx.fillStyle = 'rgb(20, 20, 20)'
      ctx.fillRect(0, 0, width, height)
      return new Promise<string>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Could not encode the Frame PNG'))
            return
          }
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = String(reader.result)
            resolve(dataUrl.slice(dataUrl.indexOf(',') + 1))
          }
          reader.onerror = () => reject(new Error('Could not read the Frame blob'))
          reader.readAsDataURL(blob)
        }, 'image/png')
      })
    },
    size,
  )
  return Buffer.from(base64, 'base64')
}

/**
 * Create a Picture PNG in the page canvas. `red-and-blue` splits the Picture
 * down the middle so a horizontal pan or placement shift moves the colour
 * boundary; `solid-green` is a single flat colour.
 */
export async function makePicturePng(
  page: Page,
  size: { width: number; height: number },
  pattern: PicturePattern,
): Promise<Buffer> {
  const base64 = await page.evaluate(
    ({ width, height, pattern }) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('2D canvas context is not available')
      if (pattern === 'red-and-blue') {
        const half = Math.floor(width / 2)
        ctx.fillStyle = 'rgb(255, 0, 0)'
        ctx.fillRect(0, 0, half, height)
        ctx.fillStyle = 'rgb(0, 0, 255)'
        ctx.fillRect(half, 0, width - half, height)
      } else {
        ctx.fillStyle = 'rgb(0, 160, 0)'
        ctx.fillRect(0, 0, width, height)
      }
      return new Promise<string>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Could not encode the Picture PNG'))
            return
          }
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = String(reader.result)
            resolve(dataUrl.slice(dataUrl.indexOf(',') + 1))
          }
          reader.onerror = () => reject(new Error('Could not read the Picture blob'))
          reader.readAsDataURL(blob)
        }, 'image/png')
      })
    },
    { ...size, pattern },
  )
  return Buffer.from(base64, 'base64')
}

export interface SamplePoint {
  x: number
  y: number
  /** Expected RGB, or null to just collect the value. */
  expect?: readonly [number, number, number]
  /** Allowed per-channel drift for lossy encodings. Defaults to 8. */
  tolerance?: number
}

export interface DecodedImage {
  width: number
  height: number
  /** Received RGB at each requested point, in order. */
  samples: Array<[number, number, number]>
}

/**
 * Decode image bytes in the real browser with `createImageBitmap` and read
 * the RGB at given coordinates. Runs on the page under test, so it uses the
 * same decoding path the application uses.
 */
export async function decodeImageSamples(
  page: Page,
  image: { base64: string; mimeType: string },
  points: Array<{ x: number; y: number }>,
): Promise<DecodedImage> {
  return page.evaluate(
    async ({ base64, type, points }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type }))
      const width = bitmap.width
      const height = bitmap.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('2D canvas context is not available')
      ctx.drawImage(bitmap, 0, 0)
      bitmap.close()
      const samples = points.map(({ x, y }) => {
        const data = ctx.getImageData(x, y, 1, 1).data
        return [data[0], data[1], data[2]] as [number, number, number]
      })
      return { width, height, samples }
    },
    { base64: image.base64, type: image.mimeType, points },
  )
}

/** Assert every sampled channel sits inside the tolerance of its expectation. */
export function expectSamples(
  points: Array<{ x: number; y: number; expect?: readonly [number, number, number]; tolerance?: number }>,
  samples: Array<[number, number, number]>,
): void {
  for (let index = 0; index < points.length; index += 1) {
    const expected = points[index]?.expect
    if (!expected) continue
    const received = samples[index]
    const tolerance = points[index]?.tolerance ?? 8
    for (let channel = 0; channel < 3; channel += 1) {
      const want = expected[channel]
      const got = received?.[channel]
      if (Math.abs((want ?? 0) - (got ?? 0)) > tolerance) {
        throw new Error(
          `Pixel (${points[index]?.x}, ${points[index]?.y}) channel ${channel}: expected about ${want}, got ${got}`,
        )
      }
    }
  }
}
