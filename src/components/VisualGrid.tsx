import type { StoredFrame } from '../lib/frameStore'
import { useState } from 'react'
import {
  calculatePreviewTransform,
  calculateCoverObjectPosition,
  type CropMode,
} from '../lib/framing'
import type { BatchPicture } from '../lib/useBatch'

interface VisualGridProps {
  frame: StoredFrame | null
  pictures: BatchPicture[]
  loading: boolean
  cropMode?: CropMode
  onCropModeChange?: (mode: CropMode) => void
  onOpenAdjustment?: (id: string) => void
  onRemove?: (id: string) => void
  onDownload?: (id: string) => void
  /**
   * Disables Clear Batch so a destructive click cannot wipe the Batch while
   * the Adjustment Modal holds unsaved work for one Picture.
   */
  clearDisabled?: boolean
  onClear: () => void
}

/**
 * Visual Grid: responsive cards showing each Framed Picture preview
 * composited with the active Frame, plus a prominent Batch count summary
 * and a global Crop Mode toggle ("Crop to Fill" vs "Fit with Blurred Background").
 * Each ready card exposes an Adjustment Modal opener plus Remove and Download actions.
 */
export function VisualGrid({
  frame,
  pictures,
  loading,
  cropMode = 'crop-to-fill',
  onCropModeChange,
  onOpenAdjustment,
  onRemove,
  onDownload,
  clearDisabled = false,
  onClear,
}: VisualGridProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const CROP_MODES: CropMode[] = ['crop-to-fill', 'fit-blurred']

  function handleCropModeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (
      event.key !== 'ArrowRight' &&
      event.key !== 'ArrowDown' &&
      event.key !== 'ArrowLeft' &&
      event.key !== 'ArrowUp'
    ) {
      return
    }
    event.preventDefault()
    const currentIndex = CROP_MODES.indexOf(cropMode)
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const offset = forward ? 1 : CROP_MODES.length - 1
    const next = CROP_MODES[(currentIndex + offset) % CROP_MODES.length]
    onCropModeChange?.(next)
    // Radio convention: the arrow key also moves focus to the newly checked radio.
    const radios = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    radios[CROP_MODES.indexOf(next)]?.focus()
  }

  let ready = 0
  let failed = 0
  let pending = 0
  for (const picture of pictures) {
    if (picture.status === 'ready') ready += 1
    else if (picture.status === 'error') failed += 1
    else pending += 1
  }
  const aspect = frame ? `${frame.width} / ${frame.height}` : '3 / 4'
  const aperture = frame?.aperture
    ? {
        left: `${(frame.aperture.x / frame.width) * 100}%`,
        top: `${(frame.aperture.y / frame.height) * 100}%`,
        width: `${(frame.aperture.width / frame.width) * 100}%`,
        height: `${(frame.aperture.height / frame.height) * 100}%`,
      }
    : undefined

  return (
    <section aria-label="Visual Grid" className="w-full max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p role="status" className="text-lg font-semibold text-neutral-100">
          {pictures.length === 0
            ? 'Batch: no Pictures yet'
            : `Batch: ${pictures.length} Picture${pictures.length === 1 ? '' : 's'} - ${ready} ready${failed > 0 ? `, ${failed} failed` : ''}${pending > 0 ? `, ${pending} reading` : ''}`}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="radiogroup"
            aria-label="Crop Mode"
            onKeyDown={handleCropModeKeyDown}
            className="inline-flex rounded-xl border border-neutral-800 bg-neutral-900 p-1"
          >
            <button
              type="button"
              role="radio"
              aria-checked={cropMode === 'crop-to-fill'}
              tabIndex={cropMode === 'crop-to-fill' ? 0 : -1}
              onClick={() => onCropModeChange?.('crop-to-fill')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98] ${
                cropMode === 'crop-to-fill'
                  ? 'bg-neutral-100 text-neutral-950 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Crop to Fill
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={cropMode === 'fit-blurred'}
              tabIndex={cropMode === 'fit-blurred' ? 0 : -1}
              onClick={() => onCropModeChange?.('fit-blurred')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98] ${
                cropMode === 'fit-blurred'
                  ? 'bg-neutral-100 text-neutral-950 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Fit with Blurred Background
            </button>
          </div>

          {pictures.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              disabled={clearDisabled}
              title={clearDisabled ? 'Close the Adjustment Modal first' : undefined}
              className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-100 transition-transform enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear Batch
            </button>
          )}
        </div>
      </div>

      {pictures.length === 0 && !loading && (
        <p className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-6 text-center text-sm text-neutral-400">
          No Pictures yet. Drop a directory above to fill the Visual Grid.
        </p>
      )}

      {(pictures.length > 0 || loading) && (
        <div
          data-testid="visual-grid"
          aria-busy={loading}
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        >
          {pictures.map((picture) =>
            picture.status === 'error' ? (
              <p
                key={picture.id}
                role="alert"
                className="rounded-xl border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm text-red-200"
              >
                {picture.error ?? `Could not read Picture ${picture.name}`}
              </p>
            ) : (
              <figure
                key={picture.id}
                className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900"
              >
                <button
                  type="button"
                  aria-label={`Adjust ${picture.name}`}
                  onClick={() => onOpenAdjustment?.(picture.id)}
                  className="relative block w-full cursor-pointer overflow-hidden bg-neutral-950"
                  style={{ aspectRatio: aspect }}
                >
                  <div
                    data-testid="aperture-box"
                    className="absolute overflow-hidden"
                    style={aperture ?? { inset: 0 }}
                  >
                    {picture.previewUrl ? (
                      cropMode === 'fit-blurred' ? (
                        <>
                          <img
                            src={picture.previewUrl}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 h-full w-full scale-110 object-cover blur-md"
                          />
                          <img
                            src={picture.previewUrl}
                            alt={`${picture.name} framed`}
                            className="relative h-full w-full object-contain"
                            style={{ transform: calculatePreviewTransform(picture.adjustment) }}
                            loading="lazy"
                          />
                        </>
                      ) : (
                        (() => {
                          const pos =
                            picture.focalPoint && picture.width > 0 && picture.height > 0
                              ? calculateCoverObjectPosition(
                                  { width: picture.width, height: picture.height },
                                  frame?.aperture ?? { width: frame?.width ?? 3, height: frame?.height ?? 4 },
                                  picture.focalPoint,
                                )
                              : undefined
                          return (
                            <img
                              src={picture.previewUrl}
                              alt={`${picture.name} framed`}
                              className="h-full w-full object-cover"
                              style={{
                                ...(pos ? { objectPosition: `${pos.x}% ${pos.y}%` } : {}),
                                transform: calculatePreviewTransform(picture.adjustment),
                              }}
                              loading="lazy"
                            />
                          )
                        })()
                      )
                    ) : (
                      <div className="h-full w-full animate-pulse bg-neutral-800" />
                    )}
                  </div>
                  {frame && (
                    <img
                      src={frame.dataUrl}
                      alt="Active Frame"
                      className="pointer-events-none absolute inset-0 h-full w-full"
                    />
                  )}
                </button>
                <figcaption className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="truncate text-xs text-neutral-300" title={picture.name}>
                    {picture.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={
                        confirmingId === picture.id
                          ? `Confirm remove ${picture.name}`
                          : `Remove picture ${picture.name}`
                      }
                      onClick={() => {
                        if (confirmingId === picture.id) {
                          onRemove?.(picture.id)
                          setConfirmingId(null)
                        } else {
                          setConfirmingId(picture.id)
                        }
                      }}
                      className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
                        confirmingId === picture.id
                          ? 'bg-red-500/20 text-red-200 hover:bg-red-500/30'
                          : 'text-neutral-400 hover:text-red-200'
                      }`}
                    >
                      {confirmingId === picture.id ? 'Confirm remove' : 'Remove'}
                    </button>
                    <button
                      type="button"
                      aria-label={`Download picture ${picture.name}`}
                      onClick={() => onDownload?.(picture.id)}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-neutral-400 hover:text-neutral-100"
                    >
                      Download Picture
                    </button>
                  </span>
                </figcaption>
              </figure>
            ),
          )}
          {loading &&
            pending === 0 &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
                <div className="animate-pulse rounded-xl bg-neutral-800" style={{ aspectRatio: aspect }} />
              </div>
            ))}
        </div>
      )}
    </section>
  )
}
