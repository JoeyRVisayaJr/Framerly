import { useId, useState } from 'react'
import type { StoredFrame } from '../lib/frameStore'
import type { ApertureRect } from '../lib/framing'
import type { FramePreset } from '../lib/indexedDbFrameStore'
import { ApertureCalibrator } from './ApertureCalibrator'
import { FramePresetPicker } from './FramePresetPicker'
import { Tooltip } from './Tooltip'

/**
 * Properties for the FrameUploader component.
 */
export interface FrameUploaderProps {
  /** The currently active Frame, or null if none is selected. */
  frame: StoredFrame | null
  /** Whether a Frame file is currently decoding. */
  loading: boolean
  /** Error message to display, or null. */
  error: string | null
  /** Saved Frame Presets in the library. */
  presets?: FramePreset[]
  /** ID of the active Frame Preset, or null if none. */
  activePresetId?: string | null
  /** Callback fired when a Frame Preset is selected. */
  onSelectPreset?: (presetId: string) => void
  /** Callback fired when a new Frame Preset file is added with an optional name. */
  onAddPreset?: (file: File, optionalName?: string) => void
  /** Callback fired when a Frame Preset is renamed. */
  onRenamePreset?: (presetId: string, newName: string) => void
  /** Callback fired when a Frame Preset is deleted. */
  onDeletePreset?: (presetId: string) => void
  /** Callback fired when a Frame file is selected directly. */
  onSelect: (file: File) => void
  /** Callback fired when clearing the active Frame. */
  onClear: () => void
  /** Optional callback fired when Aperture Calibration is confirmed. */
  onCalibrate?: (aperture: ApertureRect) => void
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
 * Aperture, replace it, clear it, and manage Frame Presets. Reports load
 * errors through `error` and busy state through `loading`.
 *
 * @param props - Component properties.
 * @returns Rendered Frame upload element.
 */
export function FrameUploader({
  frame,
  loading,
  error,
  presets = [],
  activePresetId = null,
  onSelectPreset,
  onAddPreset,
  onRenamePreset,
  onDeletePreset,
  onSelect,
  onClear,
  onCalibrate,
}: FrameUploaderProps) {
  const inputId = useId()
  const [dragging, setDragging] = useState(false)
  const [calibrating, setCalibrating] = useState(false)

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
      {onAddPreset && onSelectPreset && onRenamePreset && onDeletePreset && (
        <div className="mb-4">
          <FramePresetPicker
            presets={presets}
            activePresetId={activePresetId}
            onSelectPreset={onSelectPreset}
            onAddFrame={onAddPreset}
            onRenamePreset={onRenamePreset}
            onDeletePreset={onDeletePreset}
            disabled={loading}
          />
        </div>
      )}

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
          data-drop-state={dragging ? 'accepted' : undefined}
          className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            dragging ? 'border-emerald-400 bg-emerald-950/30' : 'border-neutral-700 bg-neutral-900'
          }`}
        >
          <p className="text-lg font-semibold text-neutral-100">
            {dragging ? 'Release to replace' : 'Drop a PNG Frame here'}
          </p>
          <p className="mt-1 text-sm text-neutral-400">Transparent area becomes the Aperture</p>
          <div data-testid="frame-empty-state" className="mt-2 text-xs text-neutral-400">
            No Frame yet. Upload a PNG Frame to begin framing event Pictures.
          </div>
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
          {...(!calibrating ? dropHandlers : {})}
          data-drop-state={dragging ? 'accepted' : undefined}
          className={`rounded-xl border bg-neutral-900 p-6 ${
            dragging ? 'border-dashed border-emerald-400' : 'border-neutral-800'
          }`}
        >
          {calibrating ? (
            <ApertureCalibrator
              frame={frame}
              onConfirm={(calibratedAperture) => {
                onCalibrate?.(calibratedAperture)
                setCalibrating(false)
              }}
              onCancel={() => setCalibrating(false)}
            />
          ) : (
            <>
              <div className="relative overflow-hidden rounded-xl bg-neutral-950">
                <img src={frame.dataUrl} alt="Frame preview" className="block max-h-80 w-full object-contain" />
                <ApertureBox frame={frame} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <p className="text-sm text-neutral-300">
                  Frame {frame.width} x {frame.height}
                  {frame.aperture
                    ? `, ${frame.calibrated ? 'Calibrated Aperture' : 'Aperture'} ${frame.aperture.width} x ${frame.aperture.height} at ${frame.aperture.x}, ${frame.aperture.y}`
                    : '. No transparent Aperture found. Calibrate one manually to frame pictures.'}
                </p>
                <Tooltip
                  label="About the Aperture"
                  content="The Aperture is the transparent region within a Frame where the Picture is positioned and visible."
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {frame.aperture ? (
                  <button
                    type="button"
                    onClick={() => setCalibrating(true)}
                    className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-100 transition-transform active:scale-[0.98]"
                  >
                    Adjust Aperture
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCalibrating(true)}
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition-transform active:scale-[0.98]"
                  >
                    Calibrate Aperture
                  </button>
                )}
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
            </>
          )}
        </div>
      )}
    </section>
  )
}
