import {
  getSourceDimensions,
  OPTICAL_CENTER,
  type FocalPoint,
} from './subjectDetection'

export interface Size {
  width: number
  height: number
}

export type CropMode = 'crop-to-fill' | 'fit-blurred'

export interface AspectFillPlacement {
  /** Uniform scale applied to the picture so it fully covers the aperture. */
  scale: number
  /** Scaled picture width in aperture pixels. */
  drawWidth: number
  /** Scaled picture height in aperture pixels. */
  drawHeight: number
  /** X offset (relative to aperture origin) to center the scaled picture. <= 0 when cropped. */
  dx: number
  /** Y offset (relative to aperture origin) to center the scaled picture. <= 0 when cropped. */
  dy: number
}

export interface FramingPlacement {
  cropMode: CropMode
  scale: number
  drawWidth: number
  drawHeight: number
  dx: number
  dy: number
  /** Background cover placement used when cropMode is 'fit-blurred' */
  background?: AspectFillPlacement
}

function assertPositiveSize(size: Size, label: string): void {
  if (
    !Number.isFinite(size.width) ||
    !Number.isFinite(size.height) ||
    size.width <= 0 ||
    size.height <= 0
  ) {
    throw new Error(`${label} must have positive width and height`)
  }
}

/**
 * Calculate `Crop to Fill` placement: scale the picture so it fully covers
 * the aperture, auto-centering on focal point or optical center without blank margins.
 */
export function calculateAspectFillPlacement(
  picture: Size,
  aperture: Size,
  focalPoint: FocalPoint = OPTICAL_CENTER,
): AspectFillPlacement {
  assertPositiveSize(picture, 'Picture')
  assertPositiveSize(aperture, 'Aperture')

  const scale = Math.max(aperture.width / picture.width, aperture.height / picture.height)
  const drawWidth = picture.width * scale
  const drawHeight = picture.height * scale

  // Position focal point at the center of the aperture
  const focalPixelX = picture.width * focalPoint.x * scale
  const focalPixelY = picture.height * focalPoint.y * scale

  const idealDx = aperture.width / 2 - focalPixelX
  const idealDy = aperture.height / 2 - focalPixelY

  // Clamp offsets so the picture completely fills the aperture (no blank borders)
  const minDx = aperture.width - drawWidth
  const maxDx = 0
  const minDy = aperture.height - drawHeight
  const maxDy = 0

  const dx = Math.min(maxDx, Math.max(minDx, idealDx))
  const dy = Math.min(maxDy, Math.max(minDy, idealDy))

  return { scale, drawWidth, drawHeight, dx, dy }
}

export interface CalculateFramingOptions {
  cropMode?: CropMode
  focalPoint?: FocalPoint
}

/**
 * Calculate placement according to the specified Crop Mode:
 * - 'crop-to-fill' (default): covers entire aperture, centered on subject.
 * - 'fit-blurred': preserves the entire picture inside the aperture with a blurred background.
 */
export function calculateFramingPlacement(
  picture: Size,
  aperture: Size,
  options: CalculateFramingOptions = {},
): FramingPlacement {
  const cropMode = options.cropMode ?? 'crop-to-fill'
  const focalPoint = options.focalPoint ?? OPTICAL_CENTER

  if (cropMode === 'fit-blurred') {
    assertPositiveSize(picture, 'Picture')
    assertPositiveSize(aperture, 'Aperture')

    const scale = Math.min(aperture.width / picture.width, aperture.height / picture.height)
    const drawWidth = picture.width * scale
    const drawHeight = picture.height * scale
    const dx = (aperture.width - drawWidth) / 2
    const dy = (aperture.height - drawHeight) / 2
    const background = calculateAspectFillPlacement(picture, aperture, focalPoint)

    return {
      cropMode,
      scale,
      drawWidth,
      drawHeight,
      dx,
      dy,
      background,
    }
  }

  const fill = calculateAspectFillPlacement(picture, aperture, focalPoint)
  return {
    cropMode: 'crop-to-fill',
    ...fill,
  }
}

/**
 * Calculate the exact CSS `object-position` percentage values (0 to 100)
 * to align a picture's focal point with the aperture center when using `object-fit: cover`.
 */
export function calculateCoverObjectPosition(
  picture: Size,
  aperture: Size,
  focalPoint: FocalPoint = OPTICAL_CENTER,
): { x: number; y: number } {
  assertPositiveSize(picture, 'Picture')
  assertPositiveSize(aperture, 'Aperture')

  const pictureAspect = picture.width / picture.height
  const apertureAspect = aperture.width / aperture.height

  let posX = 50
  let posY = 50

  if (pictureAspect > apertureAspect) {
    // Width overflows and is cropped; map focalPoint.x to aperture center
    const ratio = pictureAspect / apertureAspect
    const ideal = ((0.5 - focalPoint.x * ratio) / (1 - ratio)) * 100
    posX = Math.max(0, Math.min(100, ideal))
  } else if (pictureAspect < apertureAspect) {
    // Height overflows and is cropped; map focalPoint.y to aperture center
    const ratio = apertureAspect / pictureAspect
    const ideal = ((0.5 - focalPoint.y * ratio) / (1 - ratio)) * 100
    posY = Math.max(0, Math.min(100, ideal))
  }

  return { x: Math.round(posX * 10) / 10, y: Math.round(posY * 10) / 10 }
}

export interface ApertureRect {
  x: number
  y: number
  width: number
  height: number
}

export type PictureSource = CanvasImageSource & {
  width?: number
  height?: number
  naturalWidth?: number
  naturalHeight?: number
  videoWidth?: number
  videoHeight?: number
}

export interface RenderFramedPictureInput {
  picture: PictureSource
  frame: PictureSource
  /** Bounds of the aperture within the frame. Defaults to the full frame. */
  aperture?: ApertureRect
  cropMode?: CropMode
  focalPoint?: FocalPoint
}

function intrinsicSize(source: PictureSource, label: string): Size {
  const { width, height } = getSourceDimensions(source)
  if (width <= 0 || height <= 0) {
    throw new Error(`${label} source has no readable dimensions`)
  }
  return { width, height }
}

function assertApertureInsideFrame(aperture: ApertureRect, frame: Size): void {
  assertPositiveSize(aperture, 'Aperture')
  if (
    !Number.isFinite(aperture.x) ||
    !Number.isFinite(aperture.y) ||
    aperture.x < 0 ||
    aperture.y < 0 ||
    aperture.x + aperture.width > frame.width ||
    aperture.y + aperture.height > frame.height
  ) {
    throw new Error('Aperture must fit inside the frame bounds')
  }
}

/**
 * Create the output canvas for a framed picture.
 * The output always matches the exact pixel dimensions of the frame.
 */
export function createFramedCanvas(frame: Size): HTMLCanvasElement {
  assertPositiveSize(frame, 'Frame')
  const canvas = document.createElement('canvas')
  canvas.width = frame.width
  canvas.height = frame.height
  return canvas
}

/**
 * Composite a framed picture:
 * - In 'crop-to-fill', the picture is drawn on the bottom layer covering the aperture with subject auto-centering.
 * - In 'fit-blurred', a blurred aspect-fill version is drawn as background (with overscale to prevent border fade),
 *   and the full picture is fitted within the aperture.
 * - The frame graphic is drawn on top at full canvas size.
 */
export function renderFramedPicture(
  canvas: HTMLCanvasElement,
  input: RenderFramedPictureInput,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('2D canvas context is not available')
  }

  const frameSize = { width: canvas.width, height: canvas.height }
  assertPositiveSize(frameSize, 'Frame')

  const aperture: ApertureRect = input.aperture ?? {
    x: 0,
    y: 0,
    width: frameSize.width,
    height: frameSize.height,
  }
  assertApertureInsideFrame(aperture, frameSize)

  const pictureSize = intrinsicSize(input.picture, 'Picture')
  const placement = calculateFramingPlacement(pictureSize, aperture, {
    cropMode: input.cropMode,
    focalPoint: input.focalPoint,
  })

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.save()
  ctx.beginPath()
  ctx.rect(aperture.x, aperture.y, aperture.width, aperture.height)
  ctx.clip()

  if (placement.cropMode === 'fit-blurred' && placement.background) {
    ctx.save()
    if ('filter' in ctx) {
      ctx.filter = 'blur(20px)'
    }
    // Slight overscale (1.1x) prevents blur fade-out at aperture edges
    const overscale = 1.1
    const bgW = Math.round(placement.background.drawWidth * overscale)
    const bgH = Math.round(placement.background.drawHeight * overscale)
    const bgX = Math.round(aperture.x + placement.background.dx - (bgW - placement.background.drawWidth) / 2)
    const bgY = Math.round(aperture.y + placement.background.dy - (bgH - placement.background.drawHeight) / 2)
    ctx.drawImage(input.picture, bgX, bgY, bgW, bgH)
    ctx.restore()
  }

  // Draw foreground picture
  ctx.drawImage(
    input.picture,
    aperture.x + placement.dx,
    aperture.y + placement.dy,
    placement.drawWidth,
    placement.drawHeight,
  )

  ctx.restore()

  ctx.drawImage(input.frame, 0, 0, canvas.width, canvas.height)
}
