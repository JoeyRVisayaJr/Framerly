import type { StoredFrame } from '../lib/frameStore'
import type { BatchPicture } from '../lib/useBatch'

interface VisualGridProps {
  frame: StoredFrame | null
  pictures: BatchPicture[]
  loading: boolean
  onClear: () => void
}

/**
 * Visual Grid: responsive cards showing each Framed Picture preview
 * composited with the active Frame, plus a prominent Batch count summary.
 */
export function VisualGrid({ frame, pictures, loading, onClear }: VisualGridProps) {
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p role="status" className="text-lg font-semibold text-neutral-100">
          {pictures.length === 0
            ? 'Batch: no Pictures yet'
            : `Batch: ${pictures.length} Picture${pictures.length === 1 ? '' : 's'} - ${ready} ready${failed > 0 ? `, ${failed} failed` : ''}${pending > 0 ? `, ${pending} reading` : ''}`}
        </p>
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
                      <img
                        src={picture.previewUrl}
                        alt={`${picture.name} framed`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
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
