import { useCallback, useRef, useState } from 'react'
import {
  clampAperture,
  defaultAperture,
  resizeApertureHandle,
  validateAperture,
  type CalibrationHandle,
} from '../lib/calibration'
import type { ApertureRect } from '../lib/framing'
import type { StoredFrame } from '../lib/frameStore'

export interface ApertureCalibratorProps {
  /** The Frame being calibrated. */
  frame: StoredFrame
  /** Called when the user confirms a valid calibrated Aperture. */
  onConfirm: (aperture: ApertureRect) => void
  /** Called when the user cancels calibration. */
  onCancel: () => void
}

interface DragState {
  handle: CalibrationHandle
  startClientX: number
  startClientY: number
  startRect: ApertureRect
  containerWidth: number
  containerHeight: number
}

const HANDLE_CLASSES: Record<CalibrationHandle, string> = {
  nw: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
  ne: 'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
  se: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
  sw: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
  n: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
  s: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
  e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
  w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
  move: 'cursor-move',
}

const CORNER_HANDLES: CalibrationHandle[] = ['nw', 'ne', 'se', 'sw']
const EDGE_HANDLES: CalibrationHandle[] = ['n', 's', 'e', 'w']

/**
 * ApertureCalibrator: interactive tool to calibrate or fine-tune an Aperture
 * bounding rectangle on a Frame preview. Supports dragging corner and edge
 * handles, dragging to move, pixel alignment, reset, and validation.
 */
export function ApertureCalibrator({ frame, onConfirm, onCancel }: ApertureCalibratorProps) {
  const frameSize = { width: frame.width, height: frame.height }
  const initialRect = frame.aperture ?? defaultAperture(frameSize)

  const [rect, setRect] = useState<ApertureRect>(initialRect)
  const [validationError, setValidationError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, handle: CalibrationHandle) => {
      event.preventDefault()
      event.stopPropagation()
      const container = containerRef.current
      if (!container) return

      const bounds = container.getBoundingClientRect()
      if (bounds.width === 0 || bounds.height === 0) return

      dragRef.current = {
        handle,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startRect: rect,
        containerWidth: bounds.width,
        containerHeight: bounds.height,
      }

      event.currentTarget.setPointerCapture?.(event.pointerId)
    },
    [rect],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag) return

      const deltaClientX = event.clientX - drag.startClientX
      const deltaClientY = event.clientY - drag.startClientY

      const scaleX = frame.width / drag.containerWidth
      const scaleY = frame.height / drag.containerHeight

      const dxFrame = deltaClientX * scaleX
      const dyFrame = deltaClientY * scaleY

      const next = resizeApertureHandle(drag.startRect, drag.handle, dxFrame, dyFrame, frameSize)
      setRect(next)
      setValidationError(null)
    },
    [frame.height, frame.width, frameSize],
  )

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 10 : 1
      let dx = 0
      let dy = 0

      switch (event.key) {
        case 'ArrowLeft':
          dx = -step
          break
        case 'ArrowRight':
          dx = step
          break
        case 'ArrowUp':
          dy = -step
          break
        case 'ArrowDown':
          dy = step
          break
        default:
          return
      }

      event.preventDefault()
      const next = clampAperture(
        {
          x: rect.x + dx,
          y: rect.y + dy,
          width: rect.width,
          height: rect.height,
        },
        frameSize,
      )
      setRect(next)
      setValidationError(null)
    },
    [frameSize, rect],
  )

  const handleReset = useCallback(() => {
    const fallback = frame.detectedAperture ?? defaultAperture(frameSize)
    setRect(fallback)
    setValidationError(null)
  }, [frame.detectedAperture, frameSize])

  const handleConfirm = useCallback(() => {
    const validation = validateAperture(rect, frameSize)
    if (!validation.valid) {
      setValidationError(validation.error ?? 'Invalid Aperture dimensions')
      return
    }
    onConfirm(rect)
  }, [frameSize, onConfirm, rect])

  const leftPercent = (rect.x / frame.width) * 100
  const topPercent = (rect.y / frame.height) * 100
  const widthPercent = (rect.width / frame.width) * 100
  const heightPercent = (rect.height / frame.height) * 100

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={containerRef}
        className="relative mx-auto max-h-96 w-full touch-none select-none overflow-hidden rounded-xl bg-neutral-950"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img
          src={frame.dataUrl}
          alt="Frame calibration preview"
          className="pointer-events-none block max-h-96 w-full object-contain"
        />

        {/* Dim backdrop outside the calibrated Aperture */}
        <div
          data-testid="calibration-box"
          tabIndex={0}
          role="region"
          aria-label="Calibrated Aperture boundary"
          onKeyDown={handleKeyDown}
          onPointerDown={(e) => handlePointerDown(e, 'move')}
          className="absolute border-2 border-dashed border-emerald-400 bg-emerald-500/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-move"
          style={{
            left: `${leftPercent}%`,
            top: `${topPercent}%`,
            width: `${widthPercent}%`,
            height: `${heightPercent}%`,
          }}
        >
          {/* Corner handles */}
          {CORNER_HANDLES.map((handle) => (
            <div
              key={handle}
              role="slider"
              tabIndex={-1}
              aria-label={`${handle} handle`}
              onPointerDown={(e) => handlePointerDown(e, handle)}
              className={`absolute h-4 w-4 rounded-full border-2 border-emerald-400 bg-neutral-950 shadow-sm ${HANDLE_CLASSES[handle]}`}
            />
          ))}

          {/* Edge handles */}
          {EDGE_HANDLES.map((handle) => (
            <div
              key={handle}
              role="slider"
              tabIndex={-1}
              aria-label={`${handle} handle`}
              onPointerDown={(e) => handlePointerDown(e, handle)}
              className={`absolute h-3 w-3 rounded-sm border border-emerald-400 bg-emerald-500 shadow-sm ${HANDLE_CLASSES[handle]}`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-neutral-300">
          Aperture: {rect.width} x {rect.height} at ({rect.x}, {rect.y})
        </p>
        <p className="text-xs text-neutral-400">
          Drag handles to resize. Drag inside to move. Arrow keys nudge.
        </p>
      </div>

      {validationError && (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-950/60 px-4 py-2 text-sm text-red-200">
          {validationError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-neutral-950 transition-transform active:scale-[0.98]"
        >
          Confirm Calibration
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-100 transition-transform active:scale-[0.98]"
        >
          Reset Aperture
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-400 transition-transform active:scale-[0.98] hover:text-neutral-200"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
