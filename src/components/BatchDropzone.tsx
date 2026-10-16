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
 * Emits only supported Picture files via `onFiles`.
 */
export function BatchDropzone({ disabled, onFiles }: BatchDropzoneProps) {
  const picturesId = useId()
  const directoryId = useId()
  const [dragging, setDragging] = useState(false)

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
        if (disabled) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (disabled) return
        e.preventDefault()
        setDragging(false)
        void collectBatchFiles(e.dataTransfer).then(forwardFiles)
      }}
      className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
        dragging ? 'border-emerald-400 bg-emerald-950/30' : 'border-neutral-700 bg-neutral-900'
      }`}
    >
      <p className="text-lg font-semibold text-neutral-100">Drop event Pictures here</p>
      <p className="mt-1 text-sm text-neutral-400">
        Event directories with subdirectories welcome. JPG, PNG, WebP, and Apple HEIC convert in your browser.
      </p>
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
