import { describe, expect, it } from 'vitest'
import {
  clampAperture,
  defaultAperture,
  resizeApertureHandle,
  validateAperture,
} from './calibration'
import type { ApertureRect, Size } from './framing'

describe('calibration geometry', () => {
  const frame: Size = { width: 1000, height: 800 }

  describe('defaultAperture', () => {
    it('creates a centered rectangle covering 80% of the frame', () => {
      const aperture = defaultAperture(frame)
      expect(aperture).toEqual({
        x: 100,
        y: 80,
        width: 800,
        height: 640,
      })
    })

    it('ensures minimum 2x2 dimensions on small frames', () => {
      const aperture = defaultAperture({ width: 2, height: 2 })
      expect(aperture.width).toBeGreaterThanOrEqual(2)
      expect(aperture.height).toBeGreaterThanOrEqual(2)
    })
  })

  describe('validateAperture', () => {
    it('accepts valid apertures inside the frame bounds', () => {
      const valid: ApertureRect = { x: 50, y: 50, width: 500, height: 400 }
      expect(validateAperture(valid, frame)).toEqual({ valid: true })
    })

    it('rejects rectangles thinner than 2 pixels in width or height', () => {
      expect(validateAperture({ x: 10, y: 10, width: 1, height: 100 }, frame).valid).toBe(false)
      expect(validateAperture({ x: 10, y: 10, width: 100, height: 1 }, frame).valid).toBe(false)
    })

    it('rejects rectangles outside the frame bounds', () => {
      expect(validateAperture({ x: -5, y: 10, width: 100, height: 100 }, frame).valid).toBe(false)
      expect(validateAperture({ x: 10, y: -5, width: 100, height: 100 }, frame).valid).toBe(false)
      expect(validateAperture({ x: 950, y: 10, width: 100, height: 100 }, frame).valid).toBe(false)
      expect(validateAperture({ x: 10, y: 750, width: 100, height: 100 }, frame).valid).toBe(false)
    })
  })

  describe('clampAperture', () => {
    it('keeps a valid aperture unchanged', () => {
      const rect: ApertureRect = { x: 100, y: 100, width: 400, height: 300 }
      expect(clampAperture(rect, frame)).toEqual(rect)
    })

    it('shifts aperture inside frame bounds if moved outside', () => {
      const rect: ApertureRect = { x: -50, y: -20, width: 400, height: 300 }
      const clamped = clampAperture(rect, frame)
      expect(clamped.x).toBe(0)
      expect(clamped.y).toBe(0)
      expect(clamped.width).toBe(400)
      expect(clamped.height).toBe(300)
    })

    it('clamps bottom-right overflow', () => {
      const rect: ApertureRect = { x: 800, y: 600, width: 400, height: 300 }
      const clamped = clampAperture(rect, frame)
      expect(clamped.x + clamped.width).toBe(frame.width)
      expect(clamped.y + clamped.height).toBe(frame.height)
    })
  })

  describe('resizeApertureHandle', () => {
    const initial: ApertureRect = { x: 200, y: 150, width: 400, height: 300 }

    it('moves the aperture when handle is "move"', () => {
      const next = resizeApertureHandle(initial, 'move', 50, -30, frame)
      expect(next).toEqual({
        x: 250,
        y: 120,
        width: 400,
        height: 300,
      })
    })

    it('resizes from the south-east corner', () => {
      const next = resizeApertureHandle(initial, 'se', 40, 60, frame)
      expect(next).toEqual({
        x: 200,
        y: 150,
        width: 440,
        height: 360,
      })
    })

    it('resizes from the north-west corner, adjusting origin and dimensions', () => {
      const next = resizeApertureHandle(initial, 'nw', 20, 30, frame)
      expect(next).toEqual({
        x: 220,
        y: 180,
        width: 380,
        height: 270,
      })
    })

    it('resizes from edge handles (e.g. east, south)', () => {
      const nextE = resizeApertureHandle(initial, 'e', 30, 0, frame)
      expect(nextE.width).toBe(430)
      expect(nextE.height).toBe(300)

      const nextS = resizeApertureHandle(initial, 's', 0, 50, frame)
      expect(nextS.width).toBe(400)
      expect(nextS.height).toBe(350)
    })

    it('enforces minimum width and height of 2 pixels during resize', () => {
      const next = resizeApertureHandle(initial, 'se', -500, -500, frame)
      expect(next.width).toBeGreaterThanOrEqual(2)
      expect(next.height).toBeGreaterThanOrEqual(2)
    })

    it('clamps resized bounds to frame dimensions', () => {
      const next = resizeApertureHandle(initial, 'se', 1000, 1000, frame)
      expect(next.x + next.width).toBeLessThanOrEqual(frame.width)
      expect(next.y + next.height).toBeLessThanOrEqual(frame.height)
    })
  })
})
