import { describe, expect, it, vi } from 'vitest'
import {
  calculateAdjustedPlacement,
  calculateAspectFillPlacement,
  calculateCoverObjectPosition,
  calculatePreviewTransform,
  createFramedCanvas,
  normalizeAdjustment,
  renderFramedPicture,
} from './framing'

describe('normalizeAdjustment', () => {
  it('returns the default auto-centered adjustment when none is given', () => {
    expect(normalizeAdjustment()).toEqual({ panX: 0, panY: 0, zoom: 1, rotation: 0 })
  })

  it('clamps zoom into the 1.0x-3.0x range', () => {
    expect(normalizeAdjustment({ zoom: 0.5 }).zoom).toBe(1)
    expect(normalizeAdjustment({ zoom: 9 }).zoom).toBe(3)
    expect(normalizeAdjustment({ zoom: 1.5 }).zoom).toBe(1.5)
  })

  it('normalizes rotation to the nearest 90-degree step within 0-270', () => {
    expect(normalizeAdjustment({ rotation: 80 }).rotation).toBe(90)
    expect(normalizeAdjustment({ rotation: 400 }).rotation).toBe(0)
    expect(normalizeAdjustment({ rotation: 450 }).rotation).toBe(90)
  })

  it('treats non-finite pan and zoom values as the default', () => {
    expect(normalizeAdjustment({ panX: Number.NaN, panY: Infinity, zoom: Number.NaN })).toEqual({
      panX: 0,
      panY: 0,
      zoom: 1,
      rotation: 0,
    })
  })
})

describe('calculateAdjustedPlacement', () => {
  it('scales the auto-centered fit by zoom and keeps the focal point centered', () => {
    // Picture 800x400 into Aperture 400x400, zoom 1.5:
    // scale = 1 * 1.5 = 1.5, drawn 1200x600.
    // Optical-center focal: dx = 200 - 400*0.5*1.5 = -400, dy = 200 - 200*0.5*1.5 = -100.
    const placement = calculateAdjustedPlacement(
      { width: 800, height: 400 },
      { width: 400, height: 400 },
      { adjustment: { panX: 0, panY: 0, zoom: 1.5, rotation: 0 } },
    )
    expect(placement.scale).toBe(1.5)
    expect(placement.drawWidth).toBe(1200)
    expect(placement.dx).toBe(-400)
    expect(placement.dy).toBe(-100)
  })

  it('clamps pan in Crop to Fill so the picture still covers the aperture', () => {
    // Pan 1.5 of a 400px aperture = +600px on dx=-400 -> 200, clamped to maxDx 0.
    const placement = calculateAdjustedPlacement(
      { width: 800, height: 400 },
      { width: 400, height: 400 },
      { adjustment: { panX: 1.5, panY: 0, zoom: 1.5, rotation: 0 } },
    )
    expect(placement.dx).toBe(0)
  })

  it('leaves pan free in Fit with Blurred Background', () => {
    // Contain scale 0.5 * zoom 1 = 0.5, drawn 400x200, centered dx=0, dy=100.
    // Pan 0.25 of 400px aperture shifts dx by +100 with no clamp.
    const placement = calculateAdjustedPlacement(
      { width: 800, height: 400 },
      { width: 400, height: 400 },
      { cropMode: 'fit-blurred', adjustment: { panX: 0.25, panY: 0, zoom: 1, rotation: 0 } },
    )
    expect(placement.dx).toBe(100)
    expect(placement.dy).toBe(100)
  })

  it('re-clamps pan after a 90-degree rotation swaps the picture dimensions', () => {
    // Rotated space: picture 400x800 into 400x400 -> scale 1, drawn 400x800, dy=-200.
    // Pan y = -0.75 of 400px = -300 -> -500, clamped to minDy = 400-800 = -400.
    const placement = calculateAdjustedPlacement(
      { width: 800, height: 400 },
      { width: 400, height: 400 },
      { adjustment: { panX: 0, panY: -0.75, zoom: 1, rotation: 90 } },
    )
    expect(placement.rotation).toBe(90)
    expect(placement.drawWidth).toBe(400)
    expect(placement.drawHeight).toBe(800)
    expect(placement.dy).toBe(-400)
  })

  it('defaults to the untouched auto-centered fit with no adjustment', () => {
    const placement = calculateAdjustedPlacement(
      { width: 800, height: 400 },
      { width: 400, height: 400 },
    )
    expect(placement).toMatchObject({ scale: 1, drawWidth: 800, drawHeight: 400, dx: -200, dy: 0, rotation: 0 })
  })
})

describe('calculatePreviewTransform', () => {
  it('maps a manual adjustment to a CSS transform string', () => {
    expect(
      calculatePreviewTransform({ panX: 0.25, panY: -0.1, zoom: 2, rotation: 90 }),
    ).toBe('translate(25%, -10%) scale(2) rotate(90deg)')
  })

  it('returns the untouched transform for the auto-centered default', () => {
    expect(calculatePreviewTransform()).toBe('translate(0%, 0%) scale(1) rotate(0deg)')
  })
})

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

describe('calculateAdjustedPlacement by Crop Mode', () => {
  it('calculates Crop to Fill by default', () => {
    const placement = calculateAdjustedPlacement(
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
    const placement = calculateAdjustedPlacement(
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
      translate: vi.fn(),
      rotate: vi.fn(),
    } as unknown as CanvasRenderingContext2D & {
      drawImage: ReturnType<typeof vi.fn>
      translate: ReturnType<typeof vi.fn>
      rotate: ReturnType<typeof vi.fn>
    }
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

  it('applies an Adjustment when compositing at full resolution', () => {
    const canvas = createFramedCanvas({ width: 400, height: 400 })
    const ctx = fakeContext()
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx)

    const picture = fakeSource(800, 400)
    const frame = fakeSource(400, 400)

    renderFramedPicture(canvas, {
      picture,
      frame,
      adjustment: { panX: 1.5, panY: 0, zoom: 1.5, rotation: 0 },
    })

    // Zoom 1.5 -> scale 1.5, drawn 1200x600 at clamped dx=0, dy=-100
    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, picture, 0, -100, 1200, 600)
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, frame, 0, 0, 400, 400)
  })

  it('rotates the Picture around the aperture center without double-applying the dimension swap', () => {
    const canvas = createFramedCanvas({ width: 400, height: 400 })
    const ctx = fakeContext()
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx)

    const picture = fakeSource(800, 400)
    const frame = fakeSource(400, 400)

    renderFramedPicture(canvas, {
      picture,
      frame,
      adjustment: { panX: 0, panY: 0, zoom: 1, rotation: 90 },
    })

    // Rotated about the aperture center (200, 200)
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2)
    expect(ctx.translate).toHaveBeenCalledWith(200, 200)
    // Picture drawn in its OWN frame (800x400) centered, not into a swapped 400x800 box
    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, picture, -400, -200, 800, 400)
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
