import { useId, useState } from 'react'
import { collectBatchFiles } from '../lib/batchIngest'

interface BatchDropzoneProps {
  disabled: boolean
  onFiles: (files: File[]) => void
}

const ACCEPT =
  'image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp,image/heic,.heic,image/heif,.heif'

/**
 * Drop zone for Batch ingestion: accepts dropped event directories
 * (including subfolders) plus multi-Picture and directory selection.
 * Forwards chosen files via `onFiles`; the Batch hook keeps supported
 * Pictures and reports the rest.
 */
export function BatchDropzone({ disabled, onFiles }: BatchDropzoneProps) {
  const picturesId = useId()
  const directoryId = useId()
  const [dragging, setDragging] = useState(false)
  const [traverseError, setTraverseError] = useState<string | null>(null)

  function forwardFiles(files: File[]) {
    if (files.length > 0) onFiles(files)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) forwardFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (disabled) return
        setTraverseError(null)
        void collectBatchFiles(e.dataTransfer)
          .then(forwardFiles)
          .catch((error) => {
            // A failed directory read must not fail silently: report it so the
            // drop is not mistaken for an unsupported-empty Batch.
            setTraverseError(
              `Could not read the dropped directory: ${error instanceof Error ? error.message : 'unknown error'}`,
            )
          })
      }}
      data-drop-state={dragging ? (disabled ? 'rejected' : 'accepted') : undefined}
      className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
        dragging
          ? disabled
            ? 'border-red-500 bg-red-950/30'
            : 'border-emerald-400 bg-emerald-950/30'
          : 'border-neutral-700 bg-neutral-900'
      }`}
    >
      {traverseError && (
        <p role="alert" className="mb-4 rounded-xl border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm text-red-200">
          {traverseError}
        </p>
      )}
      <p className="text-lg font-semibold text-neutral-100">
        {dragging
          ? disabled
            ? 'Wait for pictures to finish reading'
            : 'Release to add'
          : 'Drop event Pictures here'}
      </p>
      <p className="mt-1 text-sm text-neutral-400">
        Event directories with subdirectories welcome. JPG, PNG, WebP, and Apple HEIC convert in your browser.
      </p>
      <div data-testid="batch-empty-state" className="mt-2 text-xs text-neutral-400">
        No Pictures yet. Choose files or a directory. Accepts JPG, PNG, WebP, and Apple HEIC.
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <label
          htmlFor={picturesId}
          className="cursor-pointer rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-neutral-950 transition-transform active:scale-[0.98]"
        >
          Choose Pictures
        </label>
        <label
          htmlFor={directoryId}
          className="cursor-pointer rounded-xl border border-neutral-700 px-5 py-2 text-sm font-semibold text-neutral-100 transition-transform active:scale-[0.98]"
        >
          Choose a Directory
        </label>
      </div>
      <input
        id={picturesId}
        type="file"
        accept={ACCEPT}
        multiple
        disabled={disabled}
        className="sr-only"
        aria-label="Choose Pictures"
        onChange={handleInput}
      />
      <input
        id={directoryId}
        type="file"
        accept={ACCEPT}
        multiple
        disabled={disabled}
        className="sr-only"
        aria-label="Choose a Directory"
        {...{ webkitdirectory: '' }}
        onChange={handleInput}
      />
    </div>
  )
}
