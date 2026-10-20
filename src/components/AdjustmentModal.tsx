import { useCallback, useRef } from 'react'
import {
  calculateCoverObjectPosition,
  calculatePreviewTransform,
  DEFAULT_ADJUSTMENT,
  MAX_ZOOM,
  MIN_ZOOM,
  normalizeAdjustment,
  type AdjustmentInput,
  type CropMode,
} from '../lib/framing'
import type { BatchPicture } from '../lib/batchState'
import type { StoredFrame } from '../lib/frameStore'
import { useModalDialog } from './useModalDialog'

export interface AdjustmentModalProps {
  picture: BatchPicture
  frame?: StoredFrame | null
  cropMode?: CropMode
  onAdjust: (adjustment: AdjustmentInput) => void
  onReset?: () => void
  onDownload?: () => void
  onClose: () => void
  /** Latest download error to show inside the modal, where page alerts stay covered by the backdrop. */
  notice?: string | null
}

const ROTATION_LABELS: Record<number, string> = { 0: '0', 90: '90', 180: '180', 270: '270' }

/** Arrow-key pan step as a fraction of the Aperture. */
const PAN_KEY_STEP = 0.05

function panFromKeys(event: React.KeyboardEvent, current: { panX: number; panY: number }): {
  panX: number
  panY: number
} | null {
  const step = PAN_KEY_STEP * (event.shiftKey ? 5 : 1)
  let panX = current.panX
  let panY = current.panY
  switch (event.key) {
    case 'ArrowLeft':
      panX -= step
      break
    case 'ArrowRight':
      panX += step
      break
    case 'ArrowUp':
      panY -= step
      break
    case 'ArrowDown':
      panY += step
      break
    default:
      return null
  }
  event.preventDefault()
  return { panX, panY }
}

/**
 * Adjustment Modal: live interactive pan/zoom/rotate for one Picture.
 * Changes apply immediately with no Save step; Escape, the close button,
 * or a backdrop click dismiss it.
 */
export function AdjustmentModal({
  picture,
  frame,
  cropMode = 'crop-to-fill',
  onAdjust,
  onReset,
  onDownload,
  onClose,
  notice,
}: AdjustmentModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const handleDialogKeyDown = useModalDialog({ dialogRef, onClose })
  const adjustment = normalizeAdjustment(picture.adjustment)

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dragRef.current = { x: event.clientX, y: event.clientY }
      // Pointer capture keeps drag events flowing even if the cursor leaves the preview.
      event.currentTarget.setPointerCapture?.(event.pointerId)
    },
    [],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const start = dragRef.current
      if (!start) return
      const rect = event.currentTarget.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const dx = (event.clientX - start.x) / rect.width
      const dy = (event.clientY - start.y) / rect.height
      dragRef.current = { x: event.clientX, y: event.clientY }
      onAdjust({ panX: adjustment.panX + dx, panY: adjustment.panY + dy })
    },
    [adjustment.panX, adjustment.panY, onAdjust],
  )

  const handlePointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  const apertureStyle: React.CSSProperties =
    frame?.aperture
      ? {
          left: `${(frame.aperture.x / frame.width) * 100}%`,
          top: `${(frame.aperture.y / frame.height) * 100}%`,
          width: `${(frame.aperture.width / frame.width) * 100}%`,
          height: `${(frame.aperture.height / frame.height) * 100}%`,
        }
      : { inset: 0 }

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const pan = panFromKeys(event, { panX: adjustment.panX, panY: adjustment.panY })
      if (pan) onAdjust(pan)
    },
    [adjustment.panX, adjustment.panY, onAdjust],
  )

  const objectPosition =
    picture.focalPoint && picture.width > 0 && picture.height > 0
      ? (() => {
          const pos = calculateCoverObjectPosition(
            { width: picture.width, height: picture.height },
            frame?.aperture ?? { width: frame?.width ?? 3, height: frame?.height ?? 4 },
            picture.focalPoint,
          )
          return `${pos.x}% ${pos.y}%`
        })()
      : undefined

  return (
    <div
      data-testid="modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Adjust ${picture.name}`}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
        className="w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between">
          <h2 className="truncate text-sm font-semibold text-neutral-100">{picture.name}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-neutral-400 hover:text-neutral-100"
          >
            ✕
          </button>
        </div>

        {notice && (
          <p role="alert" className="mt-3 rounded-xl border border-amber-500/40 bg-amber-950/60 px-3 py-2 text-xs text-amber-100">
            {notice}
          </p>
        )}

        <div
          data-testid="adjust-preview"
          role="application"
          aria-label={`Pan preview of ${picture.name} with arrow keys`}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative mt-3 w-full cursor-grab touch-none overflow-hidden rounded-xl bg-neutral-950 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:cursor-grabbing"
          style={{ aspectRatio: frame ? `${frame.width} / ${frame.height}` : '3 / 4' }}
        >
          <div data-testid="adjust-aperture" className="absolute overflow-hidden" style={apertureStyle}>
            <img
              src={picture.previewUrl}
              alt={`Adjusting ${picture.name}`}
              draggable={false}
              className="h-full w-full object-cover"
              style={{
                ...(objectPosition ? { objectPosition } : {}),
                transform: calculatePreviewTransform(adjustment),
              }}
            />
          </div>
          {frame && (
            <img
              src={frame.dataUrl}
              alt="Active Frame"
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex flex-1 items-center gap-2 text-xs text-neutral-300">
            <span>Zoom</span>
            <input
              type="range"
              aria-label="Zoom"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={adjustment.zoom}
              onChange={(event) => onAdjust({ zoom: Number(event.target.value) })}
              className="flex-1"
            />
            <span className="w-10 text-right tabular-nums">{adjustment.zoom.toFixed(2)}x</span>
          </label>

          <button
            type="button"
            onClick={() => onAdjust({ rotation: (adjustment.rotation + 90) % 360 })}
            className="rounded-xl border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-100"
          >
            Rotate {ROTATION_LABELS[adjustment.rotation]}°
          </button>

          <button
            type="button"
            onClick={() => (onReset ? onReset() : onAdjust(DEFAULT_ADJUSTMENT))}
            className="rounded-xl border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-100"
          >
            Reset
          </button>

          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="rounded-xl bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-950"
            >
              Download Picture
            </button>
          )}
        </div>

        <p className="mt-2 text-xs text-neutral-500">
          Drag the preview to pan, or press the arrow keys after focusing it. Crop Mode is {cropMode === 'fit-blurred' ? 'Fit with Blurred Background' : 'Crop to Fill'}.
        </p>
      </div>
    </div>
  )
}
