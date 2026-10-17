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

/** Minimum zoom for the Adjustment Modal (auto-centered fit from 04). */
export const MIN_ZOOM = 1
/** Maximum zoom for the Adjustment Modal. */
export const MAX_ZOOM = 3

/** Clockwise rotation in degrees, constrained to quarter turns. */
export type Rotation = 0 | 90 | 180 | 270

/** Manual pan/zoom/rotation state for one Picture within its Aperture. */
export interface Adjustment {
  /** Horizontal pan as a fraction of Aperture width (0 = auto-centered). */
  panX: number
  /** Vertical pan as a fraction of Aperture height (0 = auto-centered). */
  panY: number
  /** Scale multiplier applied on top of the auto-centered fit. */
  zoom: number
  /** Clockwise rotation in degrees. */
  rotation: Rotation
}

/** The untouched auto-centered state Reset restores. */
export const DEFAULT_ADJUSTMENT: Adjustment = { panX: 0, panY: 0, zoom: 1, rotation: 0 }

/**
 * A lenient Adjustment patch: any numeric rotation or out-of-range zoom is
 * accepted and normalized. Use `Adjustment` for state that must already be valid.
 */
export interface AdjustmentInput {
  panX?: number
  panY?: number
  zoom?: number
  rotation?: number
}

/**
 * Clamp an AdjustmentInput into a valid Adjustment:
 * zoom is clamped to [MIN_ZOOM, MAX_ZOOM], rotation to the nearest
 * 90-degree step within [0, 360), and non-finite values fall back to defaults.
 */
export function normalizeAdjustment(input: AdjustmentInput = {}): Adjustment {
  const zoom = Number.isFinite(input.zoom)
    ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, input.zoom as number))
    : DEFAULT_ADJUSTMENT.zoom
  const rotation = (
    Number.isFinite(input.rotation)
      ? ((Math.round((input.rotation as number) / 90) * 90) % 360 + 360) % 360
      : DEFAULT_ADJUSTMENT.rotation
  ) as Rotation
  const panX = Number.isFinite(input.panX) ? (input.panX as number) : DEFAULT_ADJUSTMENT.panX
  const panY = Number.isFinite(input.panY) ? (input.panY as number) : DEFAULT_ADJUSTMENT.panY
  return { panX, panY, zoom, rotation }
}

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
 * Remap a focal point measured on the unrotated Picture into the Picture's
 * rotated coordinate space, so the placement math keeps finding the same
 * subject after a quarter-turn. `focalPoint` stays normalized to 0-1.
 */
function rotateFocalPoint(focalPoint: FocalPoint, rotation: Rotation): FocalPoint {
  switch (rotation) {
    case 90:
      // Clockwise quarter-turn: top edge becomes the right edge.
      return { x: 1 - focalPoint.y, y: focalPoint.x }
    case 180:
      return { x: 1 - focalPoint.x, y: 1 - focalPoint.y }
    case 270:
      return { x: focalPoint.y, y: 1 - focalPoint.x }
    default:
      return focalPoint
  }
}

/** Uniform scale that makes a Picture fully cover an Aperture. */
function coverScale(picture: Size, aperture: Size): number {
  return Math.max(aperture.width / picture.width, aperture.height / picture.height)
}

/**
 * Cover placement at a given scale, auto-centering on the focal point and
 * clamping the offsets so the Picture keeps covering the Aperture (no blank
 * borders). `panX`/`panY` shift by a fraction of the Aperture before clamping.
 */
function coverPlacement(
  picture: Size,
  aperture: Size,
  focalPoint: FocalPoint,
  scale: number,
  panX = 0,
  panY = 0,
): AspectFillPlacement {
  const drawWidth = picture.width * scale
  const drawHeight = picture.height * scale
  const focalPixelX = picture.width * focalPoint.x * scale
  const focalPixelY = picture.height * focalPoint.y * scale
  const idealDx = aperture.width / 2 - focalPixelX + panX * aperture.width
  const idealDy = aperture.height / 2 - focalPixelY + panY * aperture.height
  return {
    scale,
    drawWidth,
    drawHeight,
    dx: Math.min(0, Math.max(aperture.width - drawWidth, idealDx)),
    dy: Math.min(0, Math.max(aperture.height - drawHeight, idealDy)),
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
  return coverPlacement(picture, aperture, focalPoint, coverScale(picture, aperture))
}

export interface CalculateFramingOptions {
  cropMode?: CropMode
  focalPoint?: FocalPoint
}

export interface AdjustedFramingOptions extends CalculateFramingOptions {
  /** Manual pan/zoom/rotation from the Adjustment Modal. Defaults to the auto-centered state. */
  adjustment?: AdjustmentInput
}

/** A FramingPlacement that also carries the clockwise rotation. */
export interface AdjustedPlacement extends FramingPlacement {
  rotation: Rotation
}

/**
 * Calculate placement after applying a manual Adjustment on top of the auto-centered fit.
 * - `zoom` scales the auto-centered fit.
 * - `panX`/`panY` shift the picture by a fraction of the Aperture size.
 * - `rotation` rotates the Picture clockwise by 90-degree steps around the Aperture center.
 * Pan is clamped in 'crop-to-fill' so the picture keeps covering the Aperture, and left
 * free in 'fit-blurred' where the blurred background already fills any gaps.
 */
export function calculateAdjustedPlacement(
  picture: Size,
  aperture: Size,
  options: AdjustedFramingOptions = {},
): AdjustedPlacement {
  assertPositiveSize(picture, 'Picture')
  assertPositiveSize(aperture, 'Aperture')

  const adjustment = normalizeAdjustment(options.adjustment)
  const swap = adjustment.rotation === 90 || adjustment.rotation === 270
  const rotatedPicture: Size = swap
    ? { width: picture.height, height: picture.width }
    : picture

  const cropMode = options.cropMode ?? 'crop-to-fill'
  // Placement math runs in the rotated Picture's coordinate space, so the
  // focal point (measured on the unrotated Picture) must be remapped first.
  const focalPoint = rotateFocalPoint(options.focalPoint ?? OPTICAL_CENTER, adjustment.rotation)

  if (cropMode === 'fit-blurred') {
    const fitScale = Math.min(aperture.width / rotatedPicture.width, aperture.height / rotatedPicture.height)
    const scale = fitScale * adjustment.zoom
    const drawWidth = rotatedPicture.width * scale
    const drawHeight = rotatedPicture.height * scale
    // Start centered, then apply pan freely (no clamp) so the subject can move over the blur.
    const dx = (aperture.width - drawWidth) / 2 + adjustment.panX * aperture.width
    const dy = (aperture.height - drawHeight) / 2 + adjustment.panY * aperture.height
    const background = calculateAspectFillPlacement(rotatedPicture, aperture, focalPoint)

    return {
      cropMode,
      scale,
      drawWidth,
      drawHeight,
      dx,
      dy,
      background,
      rotation: adjustment.rotation,
    }
  }

  return {
    cropMode: 'crop-to-fill',
    ...coverPlacement(
      rotatedPicture,
      aperture,
      focalPoint,
      coverScale(rotatedPicture, aperture) * adjustment.zoom,
      adjustment.panX,
      adjustment.panY,
    ),
    rotation: adjustment.rotation,
  }
}

/**
 * Build the CSS transform string that previews a manual Adjustment in the
 * Visual Grid and the Adjustment Modal. Pan values are fractions of the
 * Aperture, so they translate as percentages of the picture's own box.
 */
export function calculatePreviewTransform(adjustment?: AdjustmentInput): string {
  const { panX, panY, zoom, rotation } = normalizeAdjustment(adjustment)
  return `translate(${panX * 100}%, ${panY * 100}%) scale(${zoom}) rotate(${rotation}deg)`
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
  /** Manual pan/zoom/rotation from the Adjustment Modal. Defaults to auto-centered. */
  adjustment?: AdjustmentInput
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
  const placement = calculateAdjustedPlacement(pictureSize, aperture, {
    cropMode: input.cropMode,
    focalPoint: input.focalPoint,
    adjustment: input.adjustment,
  })

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.save()
  ctx.beginPath()
  ctx.rect(aperture.x, aperture.y, aperture.width, aperture.height)
  ctx.clip()

  if (placement.cropMode === 'fit-blurred' && placement.background) {
    const background = placement.background
    ctx.save()
    if ('filter' in ctx) {
      ctx.filter = 'blur(20px)'
    }
    // Slight overscale (1.1x) prevents blur fade-out at aperture edges
    const overscale = 1.1
    if (placement.rotation !== 0) {
      // The background placement is computed in the rotated Picture's space:
      // turn the canvas about the background box center and draw the unrotated
      // bitmap in its own aspect, like the foreground below.
      const bgCenterX = aperture.x + background.dx + background.drawWidth / 2
      const bgCenterY = aperture.y + background.dy + background.drawHeight / 2
      ctx.translate(bgCenterX, bgCenterY)
      ctx.rotate((placement.rotation * Math.PI) / 180)
      const ownWidth = pictureSize.width * background.scale * overscale
      const ownHeight = pictureSize.height * background.scale * overscale
      ctx.drawImage(input.picture, -ownWidth / 2, -ownHeight / 2, ownWidth, ownHeight)
    } else {
      const bgW = Math.round(background.drawWidth * overscale)
      const bgH = Math.round(background.drawHeight * overscale)
      const bgX = Math.round(aperture.x + background.dx - (bgW - background.drawWidth) / 2)
      const bgY = Math.round(aperture.y + background.dy - (bgH - background.drawHeight) / 2)
      ctx.drawImage(input.picture, bgX, bgY, bgW, bgH)
    }
    ctx.restore()
  }

  // Draw the foreground Picture. When rotated, turn the canvas about the
  // Aperture center and draw the Picture in its own frame so the dimension
  // swap from the placement math is not applied a second time.
  if (placement.rotation !== 0) {
    const centerX = aperture.x + placement.dx + placement.drawWidth / 2
    const centerY = aperture.y + placement.dy + placement.drawHeight / 2
    const ownWidth = pictureSize.width * placement.scale
    const ownHeight = pictureSize.height * placement.scale
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate((placement.rotation * Math.PI) / 180)
    ctx.drawImage(input.picture, -ownWidth / 2, -ownHeight / 2, ownWidth, ownHeight)
    ctx.restore()
  } else {
    ctx.drawImage(
      input.picture,
      aperture.x + placement.dx,
      aperture.y + placement.dy,
      placement.drawWidth,
      placement.drawHeight,
    )
  }

  ctx.restore()

  ctx.drawImage(input.frame, 0, 0, canvas.width, canvas.height)
}
