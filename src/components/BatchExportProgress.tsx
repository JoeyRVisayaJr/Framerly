import type { BatchExportProgressState } from '../lib/batchExport'

/** Whether the Batch Export is still rendering or compiling the archive. */
export type BatchExportPhase = 'rendering' | 'packaging'

export interface BatchExportProgressProps {
  progress: BatchExportProgressState
  phase: BatchExportPhase
  /** Cancel between Pictures and discard the partial archive. */
  onCancel?: () => void
  /** True after Cancel is pressed, while the current Picture finishes. */
  cancelRequested?: boolean
}

/**
 * Live Batch Export progress: rendered Picture count, percentage, current
 * filename, and an indeterminate Packaging phase once ZIP compilation starts.
 * Shows a Cancel action until the run finishes.
 */
export function BatchExportProgress({
  progress,
  phase,
  onCancel,
  cancelRequested = false,
}: BatchExportProgressProps) {
  const percent =
    progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0
  const packaging = phase === 'packaging'

  return (
    <section
      aria-label="Batch Export progress"
      className="w-full max-w-2xl rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="min-w-0 text-sm text-neutral-200">
          {packaging ? (
            'Packaging…'
          ) : (
            <>
              <span className="font-semibold tabular-nums">
                {progress.processed} of {progress.total} Pictures ({percent}%)
              </span>
              <span className="ml-2 truncate text-neutral-400">Rendering {progress.currentName}</span>
            </>
          )}
        </p>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelRequested}
            className="shrink-0 rounded-lg border border-neutral-700 px-3 py-1 text-xs font-semibold text-neutral-100 transition-transform enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelRequested ? 'Cancelling…' : 'Cancel'}
          </button>
        )}
      </div>
      <progress
        aria-label="Batch Export progress"
        max={progress.total}
        value={packaging ? undefined : progress.processed}
        className="mt-2 h-2 w-full overflow-hidden rounded-full accent-emerald-400"
      />
    </section>
  )
}
