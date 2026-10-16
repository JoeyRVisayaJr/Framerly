export interface Size {
  width: number
  height: number
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
 * the aperture, centering the excess for clipping.
 */
export function calculateAspectFillPlacement(
  picture: Size,
  aperture: Size,
): AspectFillPlacement {
  assertPositiveSize(picture, 'Picture')
  assertPositiveSize(aperture, 'Aperture')

  const scale = Math.max(aperture.width / picture.width, aperture.height / picture.height)
  const drawWidth = picture.width * scale
  const drawHeight = picture.height * scale
  const dx = (aperture.width - drawWidth) / 2
  const dy = (aperture.height - drawHeight) / 2

  return { scale, drawWidth, drawHeight, dx, dy }
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
}

function intrinsicSize(source: PictureSource, label: string): Size {
  const width =
    source.naturalWidth ?? (source as { videoWidth?: number }).videoWidth ?? source.width
  const height =
    source.naturalHeight ?? (source as { videoHeight?: number }).videoHeight ?? source.height
  if (width == null || height == null) {
    throw new Error(`${label} source has no readable dimensions`)
  }
  assertPositiveSize({ width, height }, label)
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
 * Composite a framed picture: the picture is drawn on the bottom layer with
 * `Crop to Fill` scaling confined to the aperture, then the frame graphic is
 * drawn on top at full canvas size.
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
  const placement = calculateAspectFillPlacement(pictureSize, aperture)

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.save()
  ctx.beginPath()
  ctx.rect(aperture.x, aperture.y, aperture.width, aperture.height)
  ctx.clip()
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
