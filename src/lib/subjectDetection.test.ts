import { describe, expect, it, vi } from 'vitest'
import {
  detectSubject,
  OPTICAL_CENTER,
} from './subjectDetection'

describe('detectSubject', () => {
  it('falls back to optical center (0.5, 0.5) by default when no faces are detected', async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600

    const focalPoint = await detectSubject(canvas, {
      detectFaces: vi.fn().mockResolvedValue([]),
    })

    expect(focalPoint).toEqual(OPTICAL_CENTER)
    expect(focalPoint).toEqual({ x: 0.5, y: 0.5 })
  })

  it('centers on a single detected face', async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1000
    canvas.height = 800

    // Face located at top-left: x: 100..300 (center 200 -> 0.2), y: 100..300 (center 200 -> 0.25)
    const detectFaces = vi.fn().mockResolvedValue([
      { x: 100, y: 100, width: 200, height: 200 },
    ])

    const focalPoint = await detectSubject(canvas, { detectFaces })

    expect(detectFaces).toHaveBeenCalledWith(canvas)
    expect(focalPoint.x).toBeCloseTo(0.2, 2)
    expect(focalPoint.y).toBeCloseTo(0.25, 2)
  })

  it('centers on the collective bounding box of multiple detected faces in group photos', async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1000
    canvas.height = 1000

    // Face 1 on left at (200, 300, 100x100) -> spans x: 200..300, y: 300..400
    // Face 2 on right at (600, 300, 100x100) -> spans x: 600..700, y: 300..400
    // Combined bounding box: x: 200..700 (center = 450 -> 0.45), y: 300..400 (center = 350 -> 0.35)
    const detectFaces = vi.fn().mockResolvedValue([
      { x: 200, y: 300, width: 100, height: 100 },
      { x: 600, y: 300, width: 100, height: 100 },
    ])

    const focalPoint = await detectSubject(canvas, { detectFaces })

    expect(focalPoint.x).toBeCloseTo(0.45, 2)
    expect(focalPoint.y).toBeCloseTo(0.35, 2)
  })

  it('clamps detected face coordinates safely between 0 and 1', async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 500
    canvas.height = 500

    // Partial face at boundary
    const detectFaces = vi.fn().mockResolvedValue([
      { x: -50, y: 450, width: 200, height: 200 },
    ])

    const focalPoint = await detectSubject(canvas, { detectFaces })

    expect(focalPoint.x).toBeGreaterThanOrEqual(0)
    expect(focalPoint.x).toBeLessThanOrEqual(1)
    expect(focalPoint.y).toBeGreaterThanOrEqual(0)
    expect(focalPoint.y).toBeLessThanOrEqual(1)
  })

  it('falls back to optical center if face detector throws an error', async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 400

    const detectFaces = vi.fn().mockRejectedValue(new Error('Detection failed'))
    const focalPoint = await detectSubject(canvas, { detectFaces })

    expect(focalPoint).toEqual(OPTICAL_CENTER)
  })
})
