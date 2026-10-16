import type { StoredFrame } from '../lib/frameStore'
import { calculateCoverObjectPosition, type CropMode } from '../lib/framing'
import type { BatchPicture } from '../lib/useBatch'

interface VisualGridProps {
  frame: StoredFrame | null
  pictures: BatchPicture[]
  loading: boolean
  cropMode?: CropMode
  onCropModeChange?: (mode: CropMode) => void
  onClear: () => void
}

/**
 * Visual Grid: responsive cards showing each Framed Picture preview
 * composited with the active Frame, plus a prominent Batch count summary
 * and a global Crop Mode toggle ("Crop to Fill" vs "Fit with Blurred Background").
 */
export function VisualGrid({
  frame,
  pictures,
  loading,
  cropMode = 'crop-to-fill',
  onCropModeChange,
  onClear,
}: VisualGridProps) {
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
            className="inline-flex rounded-xl border border-neutral-800 bg-neutral-900 p-1"
          >
            <button
              type="button"
              role="radio"
              aria-checked={cropMode === 'crop-to-fill'}
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
              className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-100 transition-transform active:scale-[0.98]"
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
                <div className="relative w-full overflow-hidden bg-neutral-950" style={{ aspectRatio: aspect }}>
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
                              style={
                                pos
                                  ? {
                                      objectPosition: `${pos.x}% ${pos.y}%`,
                                    }
                                  : undefined
                              }
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
                </div>
                <figcaption className="truncate px-3 py-2 text-xs text-neutral-300" title={picture.name}>
                  {picture.name}
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
