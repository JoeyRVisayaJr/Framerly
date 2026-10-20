import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { defaultArchiveName, sanitizeArchiveName } from '../lib/batchExport'
import type { PictureExportFormat } from '../lib/exportFormat'

export interface BatchExportDialogProps {
  /** Date used for the default archive name. Defaults to today. */
  now?: Date
  /** The Export button to focus when the dialog closes without exporting. */
  returnFocusTo?: HTMLElement | null
  /** Called with the sanitized archive name and this run's output format. */
  onConfirm: (archiveName: string, format: PictureExportFormat) => void
  /** Called on Escape or a backdrop click, without exporting. */
  onClose: () => void
}

/**
 * Batch Export naming dialog: pre-fills a dated archive name, lets the user
 * choose high-quality JPEG (default) or lossless PNG for this run, and starts
 * the export on Enter. Escape or a backdrop click closes it without exporting.
 */
export function BatchExportDialog({
  now,
  returnFocusTo,
  onConfirm,
  onClose,
}: BatchExportDialogProps) {
  const fallbackName = defaultArchiveName(now)
  const [name, setName] = useState(() => fallbackName.replace(/\.zip$/i, ''))
  const [format, setFormat] = useState<PictureExportFormat>('jpeg')
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const openerRef = useRef<Element | null>(null)
  const formatGroupId = useId()

  useEffect(() => {
    openerRef.current = document.activeElement
    inputRef.current?.focus()
    inputRef.current?.select()
    return () => {
      const opener =
        returnFocusTo ?? (openerRef.current instanceof HTMLElement ? openerRef.current : null)
      if (opener?.isConnected) opener.focus()
    }
  }, [returnFocusTo])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleDialogKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    if (!focusable || focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }, [])

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      onConfirm(sanitizeArchiveName(name, fallbackName), format)
    },
    [fallbackName, format, name, onConfirm],
  )

  return (
    <div
      data-testid="batch-export-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-export-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
        className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl outline-none"
      >
        <form onSubmit={handleSubmit}>
          <h2 id="batch-export-title" className="text-lg font-semibold text-neutral-100">
            Export All as ZIP
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            Name the archive and choose an output format for this Batch Export.
          </p>

          <label htmlFor="batch-export-name" className="mt-4 block text-xs font-semibold text-neutral-300">
            Archive name
          </label>
          <input
            ref={inputRef}
            id="batch-export-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            spellCheck={false}
            className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          />
          <p className="mt-1 text-xs text-neutral-500">.zip is added when missing.</p>

          <fieldset className="mt-4">
            <legend className="text-xs font-semibold text-neutral-300">Export format</legend>
            <div className="mt-2 flex gap-4">
              <label className="flex items-center gap-2 text-sm text-neutral-200">
                <input
                  type="radio"
                  name={formatGroupId}
                  value="jpeg"
                  checked={format === 'jpeg'}
                  onChange={() => setFormat('jpeg')}
                  className="accent-emerald-400"
                />
                JPEG (high quality)
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-200">
                <input
                  type="radio"
                  name={formatGroupId}
                  value="png"
                  checked={format === 'png'}
                  onChange={() => setFormat('png')}
                  className="accent-emerald-400"
                />
                PNG (lossless)
              </label>
            </div>
          </fieldset>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-100 transition-transform active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-950 transition-transform active:scale-[0.98]"
            >
              Export ZIP
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
