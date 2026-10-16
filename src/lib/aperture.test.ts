import { describe, expect, it } from 'vitest'
import { detectAperture, type PixelData } from './aperture'

function makePixels(
  width: number,
  height: number,
  alphaAt: (x: number, y: number) => number,
): PixelData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data[i] = 255
      data[i + 1] = 255
      data[i + 2] = 255
      data[i + 3] = alphaAt(x, y)
    }
  }
  return { width, height, data }
}

const opaque = () => 255
const transparent = () => 0

describe('detectAperture', () => {
  it('finds the bounding box of a centered transparent region', () => {
    // 10x10 frame, transparent 4x4 square at (3,2)..(6,5)
    const pixels = makePixels(10, 10, (x, y) =>
      x >= 3 && x <= 6 && y >= 2 && y <= 5 ? 0 : 255,
    )
    expect(detectAperture(pixels)).toEqual({ x: 3, y: 2, width: 4, height: 4 })
  })

  it('returns null for a fully opaque frame', () => {
    expect(detectAperture(makePixels(8, 8, opaque))).toBeNull()
  })

  it('returns full bounds for a fully transparent frame', () => {
    const pixels = makePixels(5, 4, transparent)
    expect(detectAperture(pixels)).toEqual({ x: 0, y: 0, width: 5, height: 4 })
  })

  it('ignores a single transparent pixel as noise', () => {
    const pixels = makePixels(8, 8, (x, y) => (x === 4 && y === 4 ? 0 : 255))
    expect(detectAperture(pixels)).toBeNull()
  })

  it('respects a custom alpha threshold', () => {
    // Semi-transparent region at alpha 100: opaque under default, open under 128
    const pixels = makePixels(6, 6, (x, y) =>
      x >= 1 && x <= 4 && y >= 1 && y <= 4 ? 100 : 255,
    )
    expect(detectAperture(pixels)).toBeNull()
    expect(detectAperture(pixels, 128)).toEqual({ x: 1, y: 1, width: 4, height: 4 })
  })

  it('rejects mismatched pixel data', () => {
    expect(() =>
      detectAperture({ width: 4, height: 4, data: new Uint8ClampedArray(10) }),
    ).toThrow()
    expect(() =>
      detectAperture({ width: 0, height: 4, data: new Uint8ClampedArray(0) }),
    ).toThrow()
  })
})
