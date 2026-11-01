import type { ApertureRect, Size } from './framing'

/** Draggable handles on the calibration boundary box. */
export type CalibrationHandle =
  | 'nw'
  | 'ne'
  | 'se'
  | 'sw'
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'move'

/** Result of validating an Aperture bounding rectangle. */
export interface ApertureValidationResult {
  valid: boolean
  error?: string
}

const MIN_APERTURE_EDGE = 2

/**
 * Creates a centered default Aperture covering ~80% of the Frame dimensions.
 *
 * @param frame The pixel dimensions of the Frame.
 * @returns An ApertureRect centered within the Frame.
 */
export function defaultAperture(frame: Size): ApertureRect {
  const width = Math.max(MIN_APERTURE_EDGE, Math.round(frame.width * 0.8))
  const height = Math.max(MIN_APERTURE_EDGE, Math.round(frame.height * 0.8))
  const x = Math.max(0, Math.round((frame.width - width) / 2))
  const y = Math.max(0, Math.round((frame.height - height) / 2))
  return { x, y, width, height }
}

/**
 * Validates whether an Aperture rectangle meets minimum dimension requirements
 * and fits inside the Frame bounds, matching the rules in `detectAperture`.
 *
 * @param rect The candidate Aperture coordinates and dimensions.
 * @param frame The pixel dimensions of the Frame.
 * @returns An object indicating whether the rectangle is valid, and an error string if not.
 */
export function validateAperture(rect: ApertureRect, frame: Size): ApertureValidationResult {
  if (
    !Number.isInteger(rect.x) ||
    !Number.isInteger(rect.y) ||
    !Number.isInteger(rect.width) ||
    !Number.isInteger(rect.height)
  ) {
    return { valid: false, error: 'Aperture coordinates must be whole integers.' }
  }
  if (rect.width < MIN_APERTURE_EDGE || rect.height < MIN_APERTURE_EDGE) {
    return {
      valid: false,
      error: `Aperture must be at least ${MIN_APERTURE_EDGE}x${MIN_APERTURE_EDGE} pixels.`,
    }
  }
  if (
    rect.x < 0 ||
    rect.y < 0 ||
    rect.x + rect.width > frame.width ||
    rect.y + rect.height > frame.height
  ) {
    return { valid: false, error: 'Aperture must fit completely within the Frame bounds.' }
  }
  return { valid: true }
}

/**
 * Clamps an existing Aperture rectangle so it stays fully inside the Frame bounds.
 *
 * @param rect Candidate Aperture rectangle.
 * @param frame Frame pixel dimensions.
 * @returns The clamped ApertureRect.
 */
export function clampAperture(rect: ApertureRect, frame: Size): ApertureRect {
  const width = Math.min(frame.width, Math.max(MIN_APERTURE_EDGE, Math.round(rect.width)))
  const height = Math.min(frame.height, Math.max(MIN_APERTURE_EDGE, Math.round(rect.height)))
  const maxX = frame.width - width
  const maxY = frame.height - height
  const x = Math.max(0, Math.min(maxX, Math.round(rect.x)))
  const y = Math.max(0, Math.min(maxY, Math.round(rect.y)))
  return { x, y, width, height }
}

/**
 * Adjusts an Aperture rectangle based on dragging a specific handle or moving the box.
 * Coordinates are rounded to whole Frame pixels and clamped to Frame boundaries.
 *
 * @param start Initial Aperture rectangle before drag started.
 * @param handle Which handle is being dragged, or 'move' for panning the entire box.
 * @param dx Horizontal drag distance in Frame pixels.
 * @param dy Vertical drag distance in Frame pixels.
 * @param frame Frame pixel dimensions.
 * @returns The updated ApertureRect.
 */
export function resizeApertureHandle(
  start: ApertureRect,
  handle: CalibrationHandle,
  dx: number,
  dy: number,
  frame: Size,
): ApertureRect {
  const deltaX = Math.round(dx)
  const deltaY = Math.round(dy)

  if (handle === 'move') {
    return clampAperture(
      {
        x: start.x + deltaX,
        y: start.y + deltaY,
        width: start.width,
        height: start.height,
      },
      frame,
    )
  }

  let left = start.x
  let top = start.y
  let right = start.x + start.width
  let bottom = start.y + start.height

  if (handle === 'nw' || handle === 'w' || handle === 'sw') {
    left = Math.min(right - MIN_APERTURE_EDGE, Math.max(0, start.x + deltaX))
  }
  if (handle === 'ne' || handle === 'e' || handle === 'se') {
    right = Math.max(left + MIN_APERTURE_EDGE, Math.min(frame.width, start.x + start.width + deltaX))
  }
  if (handle === 'nw' || handle === 'n' || handle === 'ne') {
    top = Math.min(bottom - MIN_APERTURE_EDGE, Math.max(0, start.y + deltaY))
  }
  if (handle === 'sw' || handle === 's' || handle === 'se') {
    bottom = Math.max(top + MIN_APERTURE_EDGE, Math.min(frame.height, start.y + start.height + deltaY))
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}
