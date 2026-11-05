import { useId, useState } from 'react'
import type { FramePreset } from '../lib/indexedDbFrameStore'

/**
 * Properties for the FramePresetPicker component.
 */
export interface FramePresetPickerProps {
  /** All saved Frame Presets in the library. */
  presets: FramePreset[]
  /** ID of the active Frame Preset, or null if none is active. */
  activePresetId: string | null
  /** Callback fired when the user selects a Frame Preset to activate it. */
  onSelectPreset: (presetId: string) => void
  /** Callback fired when the user adds a new Frame file, optionally with a descriptive name. */
  onAddFrame: (file: File, optionalName?: string) => void
  /** Callback fired when the user renames an existing Frame Preset. */
  onRenamePreset: (presetId: string, newName: string) => void
  /** Callback fired when the user deletes an existing Frame Preset. */
  onDeletePreset: (presetId: string) => void
  /** Optional flag to disable actions when the app is busy. */
  disabled?: boolean
}

/**
 * FramePresetPicker: displays saved Frame Presets, provides switching between
 * them, an Add Frame action with an optional naming workflow, and inline renaming
 * and deleting of presets with confirmation.
 *
 * @param props - Component properties.
 * @returns Rendered Frame Preset selector element.
 */
export function FramePresetPicker({
  presets,
  activePresetId,
  onSelectPreset,
  onAddFrame,
  onRenamePreset,
  onDeletePreset,
  disabled = false,
}: FramePresetPickerProps) {
  const addInputId = useId()
  const nameInputId = useId()
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [presetNameInput, setPresetNameInput] = useState('')
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      setPendingFile(file)
      setPresetNameInput('')
    }
    e.target.value = ''
  }

  function handleSaveNewPreset(e: React.FormEvent) {
    e.preventDefault()
    if (!pendingFile) return
    const name = presetNameInput.trim() ? presetNameInput.trim() : undefined
    onAddFrame(pendingFile, name)
    setPendingFile(null)
    setPresetNameInput('')
  }

  function handleCancelNewPreset() {
    setPendingFile(null)
    setPresetNameInput('')
  }

  function handleStartRename(preset: FramePreset) {
    setEditingPresetId(preset.id)
    setEditingName(preset.name)
    setConfirmingDeleteId(null)
  }

  function handleSaveRename(presetId: string) {
    const trimmed = editingName.trim()
    if (trimmed) {
      onRenamePreset(presetId, trimmed)
    }
    setEditingPresetId(null)
    setEditingName('')
  }

  function handleCancelRename() {
    setEditingPresetId(null)
    setEditingName('')
  }

  return (
    <div aria-label="Frame Preset Library" className="w-full max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-wide text-neutral-300 uppercase">
          Frame Presets
        </h3>
        <div>
          <label
            htmlFor={addInputId}
            className={`cursor-pointer rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-neutral-950 transition-transform active:scale-[0.98] ${
              disabled ? 'pointer-events-none opacity-40' : ''
            }`}
          >
            + Add Frame
          </label>
          <input
            id={addInputId}
            type="file"
            accept="image/png,.png"
            className="sr-only"
            aria-label="Add Frame"
            disabled={disabled}
            onChange={handleFileSelected}
          />
        </div>
      </div>

      {pendingFile && (
        <form
          aria-label="Name Frame Preset"
          onSubmit={handleSaveNewPreset}
          className="mt-3 rounded-xl border border-neutral-700 bg-neutral-900 p-4"
        >
          <label htmlFor={nameInputId} className="block text-xs font-semibold text-neutral-200">
            Preset Name (optional)
          </label>
          <p className="mt-0.5 text-xs text-neutral-400">
            Give this Frame Preset a descriptive name (e.g. &quot;Gala 2026 - Story 9:16&quot;).
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id={nameInputId}
              type="text"
              aria-label="Preset Name"
              placeholder={pendingFile ? pendingFile.name.replace(/\.[^/.]+$/, '') : 'e.g. Gala 2026 - Story 9:16'}
              value={presetNameInput}
              onChange={(e) => setPresetNameInput(e.target.value)}
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-neutral-950 transition-transform active:scale-[0.98]"
            >
              Save Preset
            </button>
            <button
              type="button"
              onClick={handleCancelNewPreset}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:text-neutral-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {presets.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((preset) => {
            const isActive = preset.id === activePresetId
            const isEditing = editingPresetId === preset.id
            const isConfirmingDelete = confirmingDeleteId === preset.id

            if (isEditing) {
              return (
                <div
                  key={preset.id}
                  className="flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-900 p-1.5"
                >
                  <input
                    type="text"
                    aria-label="Rename preset"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="rounded-md border border-neutral-600 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 focus:border-emerald-500 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    aria-label="Save rename"
                    onClick={() => handleSaveRename(preset.id)}
                    className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-neutral-950"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel rename"
                    onClick={handleCancelRename}
                    className="rounded-md border border-neutral-700 px-2 py-1 text-xs font-semibold text-neutral-300"
                  >
                    Cancel
                  </button>
                </div>
              )
            }

            return (
              <div
                key={preset.id}
                className={`inline-flex items-center gap-1.5 rounded-xl border p-1 transition-all ${
                  isActive
                    ? 'border-emerald-500/60 bg-emerald-950/30 text-emerald-100'
                    : 'border-neutral-800 bg-neutral-900 text-neutral-300'
                }`}
              >
                <button
                  type="button"
                  aria-pressed={isActive}
                  aria-label={`Select ${preset.name}`}
                  onClick={() => onSelectPreset(preset.id)}
                  disabled={disabled}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-500 text-neutral-950 font-semibold'
                      : 'hover:text-neutral-100'
                  }`}
                >
                  {preset.name}
                  <span className="ml-1.5 opacity-60">
                    ({preset.width}x{preset.height})
                  </span>
                </button>

                <div className="flex items-center gap-1 pr-1">
                  <button
                    type="button"
                    aria-label={`Rename ${preset.name}`}
                    disabled={disabled}
                    onClick={() => handleStartRename(preset)}
                    className="rounded p-1 text-[10px] text-neutral-400 hover:text-neutral-200"
                    title="Rename preset"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    aria-label={
                      isConfirmingDelete
                        ? `Confirm delete ${preset.name}`
                        : `Delete ${preset.name}`
                    }
                    disabled={disabled}
                    onClick={() => {
                      if (isConfirmingDelete) {
                        onDeletePreset(preset.id)
                        setConfirmingDeleteId(null)
                      } else {
                        setConfirmingDeleteId(preset.id)
                      }
                    }}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                      isConfirmingDelete
                        ? 'bg-red-500/30 text-red-200 hover:bg-red-500/40'
                        : 'text-neutral-400 hover:text-red-300'
                    }`}
                    title={isConfirmingDelete ? 'Click again to confirm' : 'Delete preset'}
                  >
                    {isConfirmingDelete ? 'Confirm' : 'Delete'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
