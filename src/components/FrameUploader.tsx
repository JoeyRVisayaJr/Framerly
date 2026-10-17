import { useId, useState } from 'react'
import type { StoredFrame } from '../lib/frameStore'

interface FrameUploaderProps {
  frame: StoredFrame | null
  loading: boolean
  error: string | null
  onSelect: (file: File) => void
  onClear: () => void
}

function FrameFileInput({ id, onFiles, label }: { id: string; onFiles: (files: FileList | null) => void; label: string }) {
  return (
    <input
      id={id}
      type="file"
      accept="image/png,.png"
      className="sr-only"
      aria-label={label}
      onChange={(e) => {
        onFiles(e.target.files)
        e.target.value = ''
      }}
    />
  )
}

/** Draws the detected Aperture outline on the Frame preview. */
function ApertureBox({ frame }: { frame: StoredFrame }) {
  if (!frame.aperture) return null
  const { x, y, width, height } = frame.aperture
  return (
    <div
      data-testid="aperture-box"
      aria-hidden="true"
      className="pointer-events-none absolute rounded-sm border-2 border-emerald-400"
      style={{
        left: `${(x / frame.width) * 100}%`,
        top: `${(y / frame.height) * 100}%`,
        width: `${(width / frame.width) * 100}%`,
        height: `${(height / frame.height) * 100}%`,
      }}
    />
  )
}

/**
 * FrameUploader: drop or pick a PNG Frame, preview it with the detected
 * Aperture, replace it, and clear it. Reports load errors through `error`
 * and busy state through `loading`.
 */
export function FrameUploader({ frame, loading, error, onSelect, onClear }: FrameUploaderProps) {
  const inputId = useId()
  const [dragging, setDragging] = useState(false)

  function handleFiles(files: FileList | null) {
    if (files && files.length > 0) onSelect(files[0])
  }

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(true)
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      handleFiles(e.dataTransfer.files)
    },
  }

  return (
    <section aria-label="Frame upload" className="w-full max-w-2xl">
      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading && (
        <div aria-busy="true" className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center">
          <div className="mx-auto h-40 animate-pulse rounded-xl bg-neutral-800" />
          <p className="mt-4 text-sm text-neutral-400">Reading Frame…</p>
        </div>
      )}

      {!loading && !frame && (
        <div
          {...dropHandlers}
          className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            dragging ? 'border-emerald-400 bg-emerald-950/30' : 'border-neutral-700 bg-neutral-900'
          }`}
        >
          <p className="text-lg font-semibold text-neutral-100">Drop a PNG Frame here</p>
          <p className="mt-1 text-sm text-neutral-400">Transparent area becomes the Aperture</p>
          <label
            htmlFor={inputId}
            className="mt-4 inline-block cursor-pointer rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-neutral-950 transition-transform active:scale-[0.98]"
          >
            Choose a PNG Frame
          </label>
          <FrameFileInput id={inputId} onFiles={handleFiles} label="Choose a PNG Frame" />
        </div>
      )}

      {!loading && frame && (
        <div
          {...dropHandlers}
          className={`rounded-xl border bg-neutral-900 p-6 ${
            dragging ? 'border-dashed border-emerald-400' : 'border-neutral-800'
          }`}
        >
          <div className="relative overflow-hidden rounded-xl bg-neutral-950">
            <img src={frame.dataUrl} alt="Frame preview" className="block max-h-80 w-full object-contain" />
            <ApertureBox frame={frame} />
          </div>
          <p className="mt-3 text-sm text-neutral-300">
            Frame {frame.width} x {frame.height}
            {frame.aperture
              ? `, Aperture ${frame.aperture.width} x ${frame.aperture.height} at ${frame.aperture.x}, ${frame.aperture.y}`
              : '. No transparent Aperture found. You can calibrate one manually later.'}
          </p>
          <div className="mt-4 flex gap-3">
            <label
              htmlFor={inputId}
              className="cursor-pointer rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-100 transition-transform active:scale-[0.98]"
            >
              Replace Frame
            </label>
            <FrameFileInput id={inputId} onFiles={handleFiles} label="Choose a PNG Frame" />
            <button
              type="button"
              onClick={onClear}
              className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-100 transition-transform active:scale-[0.98]"
            >
              Clear Frame
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-500">Tip: drop a new PNG Frame anywhere here to replace it.</p>
        </div>
      )}
    </section>
  )
}
