import { describe, expect, it, vi } from 'vitest'
import {
  calculateAspectFillPlacement,
  calculateCoverObjectPosition,
  calculateFramingPlacement,
  createFramedCanvas,
  renderFramedPicture,
} from './framing'

describe('calculateAspectFillPlacement', () => {
  it('covers a square aperture with a landscape picture, centering the excess', () => {
    // Picture 800x400 into aperture 400x400:
    // scale = max(400/800, 400/400) = 1 → drawn 800x400, dx=-200, dy=0
    expect(
      calculateAspectFillPlacement(
        { width: 800, height: 400 },
        { width: 400, height: 400 },
      ),
    ).toEqual({ scale: 1, drawWidth: 800, drawHeight: 400, dx: -200, dy: 0 })
  })

  it('covers a square aperture with a portrait picture, centering the excess', () => {
    // Picture 400x800 into aperture 400x400:
    // scale = max(400/400, 400/800) = 1 → drawn 400x800, dx=0, dy=-200
    expect(
      calculateAspectFillPlacement(
        { width: 400, height: 800 },
        { width: 400, height: 400 },
      ),
    ).toEqual({ scale: 1, drawWidth: 400, drawHeight: 800, dx: 0, dy: -200 })
  })

  it('scales up a small picture to fully cover a larger aperture', () => {
    // Picture 200x100 into aperture 400x400:
    // scale = max(2, 4) = 4 → drawn 800x400, dx=-200, dy=0
    expect(
      calculateAspectFillPlacement(
        { width: 200, height: 100 },
        { width: 400, height: 400 },
      ),
    ).toEqual({ scale: 4, drawWidth: 800, drawHeight: 400, dx: -200, dy: 0 })
  })

  it('returns zero offsets when aspect ratios already match', () => {
    expect(
      calculateAspectFillPlacement(
        { width: 1600, height: 900 },
        { width: 800, height: 450 },
      ),
    ).toEqual({ scale: 0.5, drawWidth: 800, drawHeight: 450, dx: 0, dy: 0 })
  })

  it('rejects non-positive dimensions', () => {
    expect(() =>
      calculateAspectFillPlacement({ width: 0, height: 100 }, { width: 100, height: 100 }),
    ).toThrow()
    expect(() =>
      calculateAspectFillPlacement({ width: 100, height: 100 }, { width: -5, height: 100 }),
    ).toThrow()
  })

  it('shifts offset so detected focal point remains centered in the aperture', () => {
    // Picture 800x400 into Aperture 400x400: scale = 1, drawn 800x400.
    // Excess is in width: minDx = -400, maxDx = 0.
    // If focal point is at x = 0.25 (fx = 200), center is at 200 in picture.
    // Ideal dx to place 200 at aperture center (200): 200 - 200 = 0.
    const placement = calculateAspectFillPlacement(
      { width: 800, height: 400 },
      { width: 400, height: 400 },
      { x: 0.25, y: 0.5 },
    )
    expect(placement.dx).toBe(0)
    expect(placement.dy).toBe(0)
  })

  it('clamps auto-centering offset at boundaries so no blank borders appear', () => {
    // Picture 800x400 into Aperture 400x400: scale = 1, drawn 800x400.
    // If focal point is extreme right x = 0.95 (fx = 760):
    // idealDx = 200 - 760 = -560.
    // Clamped between minDx (-400) and maxDx (0) -> -400.
    const placement = calculateAspectFillPlacement(
      { width: 800, height: 400 },
      { width: 400, height: 400 },
      { x: 0.95, y: 0.5 },
    )
    expect(placement.dx).toBe(-400)
    expect(placement.dy).toBe(0)
  })
})

describe('calculateFramingPlacement', () => {
  it('calculates Crop to Fill by default', () => {
    const placement = calculateFramingPlacement(
      { width: 800, height: 400 },
      { width: 400, height: 400 },
      { cropMode: 'crop-to-fill' },
    )
    expect(placement.cropMode).toBe('crop-to-fill')
    expect(placement.drawWidth).toBe(800)
    expect(placement.drawHeight).toBe(400)
    expect(placement.dx).toBe(-200)
    expect(placement.dy).toBe(0)
  })

  it('calculates Fit with Blurred Background: preserves full picture inside aperture', () => {
    // Picture 800x400 into Aperture 400x400:
    // contain scale = min(400/800, 400/400) = 0.5 -> drawn 400x200, dx=0, dy=(400-200)/2 = 100.
    // background cover scale = max(0.5, 1) = 1 -> drawn 800x400, dx=-200, dy=0.
    const placement = calculateFramingPlacement(
      { width: 800, height: 400 },
      { width: 400, height: 400 },
      { cropMode: 'fit-blurred' },
    )
    expect(placement.cropMode).toBe('fit-blurred')
    expect(placement.scale).toBe(0.5)
    expect(placement.drawWidth).toBe(400)
    expect(placement.drawHeight).toBe(200)
    expect(placement.dx).toBe(0)
    expect(placement.dy).toBe(100)
    expect(placement.background).toEqual({
      scale: 1,
      drawWidth: 800,
      drawHeight: 400,
      dx: -200,
      dy: 0,
    })
  })
})

describe('calculateCoverObjectPosition', () => {
  it('returns 50% 50% for optical center when picture and aperture aspect ratios match', () => {
    const pos = calculateCoverObjectPosition(
      { width: 800, height: 600 },
      { width: 400, height: 300 },
      { x: 0.5, y: 0.5 },
    )
    expect(pos).toEqual({ x: 50, y: 50 })
  })

  it('calculates horizontal percentage so focal point is centered in aperture', () => {
    // Picture 800x400 (aspect 2.0), aperture 400x400 (aspect 1.0) -> ratio = 2.0.
    // Focal point at x = 0.25 -> (0.5 - 0.25*2)/(1-2) * 100 = 0%.
    const pos = calculateCoverObjectPosition(
      { width: 800, height: 400 },
      { width: 400, height: 400 },
      { x: 0.25, y: 0.5 },
    )
    expect(pos).toEqual({ x: 0, y: 50 })
  })

  it('clamps position percentage between 0 and 100', () => {
    // Extreme right focal point
    const pos = calculateCoverObjectPosition(
      { width: 800, height: 400 },
      { width: 400, height: 400 },
      { x: 0.95, y: 0.5 },
    )
    expect(pos.x).toBe(100)
    expect(pos.y).toBe(50)
  })
})

describe('createFramedCanvas', () => {
  it('matches the exact pixel dimensions of the frame', () => {
    const canvas = createFramedCanvas({ width: 1080, height: 1920 })
    expect(canvas.width).toBe(1080)
    expect(canvas.height).toBe(1920)
  })

  it('rejects non-positive frame dimensions', () => {
    expect(() => createFramedCanvas({ width: 0, height: 100 })).toThrow()
  })
})

describe('renderFramedPicture', () => {
  function fakeContext() {
    return {
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
    } as unknown as CanvasRenderingContext2D & { drawImage: ReturnType<typeof vi.fn> }
  }

  function fakeSource(width: number, height: number) {
    return { width, height } as unknown as CanvasImageSource & {
      width: number
      height: number
    }
  }

  it('draws the picture beneath the frame with aspect-fill placement', () => {
    const frameSize = { width: 400, height: 400 }
    const canvas = createFramedCanvas(frameSize)
    const ctx = fakeContext()
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx)

    const picture = fakeSource(800, 400)
    const frame = fakeSource(400, 400)

    renderFramedPicture(canvas, { picture, frame })

    expect(ctx.drawImage).toHaveBeenCalledTimes(2)
    // First call: picture (bottom layer), aspect-fill scaled to 800x400 at (-200, 0)
    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, picture, -200, 0, 800, 400)
    // Second call: frame (top layer) at full canvas size
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, frame, 0, 0, 400, 400)
  })

  it('confines the picture to a custom aperture while keeping output at frame size', () => {
    const canvas = createFramedCanvas({ width: 600, height: 400 })
    const ctx = fakeContext()
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx)

    const picture = fakeSource(200, 200)
    const frame = fakeSource(600, 400)

    renderFramedPicture(canvas, {
      picture,
      frame,
      aperture: { x: 100, y: 50, width: 400, height: 300 },
    })

    // Picture 200x200 into 400x300 aperture: scale=2 → 400x400 at aperture origin + (0,-50)
    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, picture, 100, 0, 400, 400)
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, frame, 0, 0, 600, 400)
    expect(canvas.width).toBe(600)
    expect(canvas.height).toBe(400)
  })

  it('rejects an aperture that extends outside the frame', () => {
    const canvas = createFramedCanvas({ width: 400, height: 400 })
    const ctx = fakeContext()
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx)

    expect(() =>
      renderFramedPicture(canvas, {
        picture: fakeSource(100, 100),
        frame: fakeSource(400, 400),
        aperture: { x: 350, y: 0, width: 100, height: 100 },
      }),
    ).toThrow()
  })

  it('renders Crop to Fill with focal point auto-centering shift', () => {
    const canvas = createFramedCanvas({ width: 400, height: 400 })
    const ctx = fakeContext()
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx)

    const picture = fakeSource(800, 400)
    const frame = fakeSource(400, 400)

    renderFramedPicture(canvas, {
      picture,
      frame,
      focalPoint: { x: 0.25, y: 0.5 },
      cropMode: 'crop-to-fill',
    })

    // Picture drawn at (0, 0) instead of default center-crop (-200, 0)
    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, picture, 0, 0, 800, 400)
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, frame, 0, 0, 400, 400)
  })

  it('renders Fit with Blurred Background by drawing blurred background then foreground', () => {
    const canvas = createFramedCanvas({ width: 400, height: 400 })
    const ctx = fakeContext()
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx)

    const picture = fakeSource(800, 400)
    const frame = fakeSource(400, 400)

    renderFramedPicture(canvas, {
      picture,
      frame,
      cropMode: 'fit-blurred',
    })

    // Total 3 drawImage calls:
    // 1: Blurred background cover (overscaled 1.1x to prevent aperture edge fade)
    // 2: Foreground contain (400x200 at 0, 100)
    // 3: Frame overlay (400x400 at 0, 0)
    expect(ctx.drawImage).toHaveBeenCalledTimes(3)
    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, picture, -240, -20, 880, 440)
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, picture, 0, 100, 400, 200)
    expect(ctx.drawImage).toHaveBeenNthCalledWith(3, frame, 0, 0, 400, 400)
  })
})
