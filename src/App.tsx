import { useCallback, useEffect, useState } from 'react'
import { BatchDropzone } from './components/BatchDropzone'
import { FrameUploader } from './components/FrameUploader'
import { VisualGrid } from './components/VisualGrid'
import {
  clearFrame,
  decodeFrameFile,
  isPngFile,
  loadFrame,
  saveFrame,
  type StoredFrame,
} from './lib/frameStore'
import type { CropMode } from './lib/framing'
import { useBatchIngest } from './lib/useBatch'

export default function App() {
  const [frame, setFrame] = useState<StoredFrame | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cropMode, setCropMode] = useState<CropMode>('crop-to-fill')
  const { pictures, loading: batchLoading, error: batchError, addFiles, clearBatch } = useBatchIngest()

  useEffect(() => {
    setFrame(loadFrame(window.localStorage))
  }, [])

  const handleSelect = useCallback(async (file: File) => {
    if (!isPngFile(file)) {
      setError('Frame must be a PNG file')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const decoded = await decodeFrameFile(file)
      try {
        saveFrame(window.localStorage, decoded)
      } catch {
        setError('Frame loaded, but it is too large to persist. It will be lost on reload.')
      }
      setFrame(decoded)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the Frame file')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleClear = useCallback(() => {
    clearFrame(window.localStorage)
    setFrame(null)
    setError(null)
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center bg-neutral-950 px-4 py-10 text-neutral-50">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-3xl font-bold tracking-tight">Framerly</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Upload a branded PNG Frame to begin. Its transparent area becomes the Aperture.
        </p>
      </div>
      <div className="mt-8 flex w-full justify-center">
        <FrameUploader
          frame={frame}
          loading={loading}
          error={error}
          onSelect={handleSelect}
          onClear={handleClear}
        />
      </div>
      <div className="mt-10 flex w-full max-w-6xl flex-col items-center gap-4">
        <div className="w-full max-w-2xl">
          <h2 className="text-xl font-semibold tracking-tight">Batch Pictures</h2>
          <p className="mt-1 text-sm text-neutral-400">
            {frame
              ? 'Add Pictures to preview each Framed Picture in the Visual Grid.'
              : 'Upload a Frame first, then add Pictures to fill the Visual Grid.'}
          </p>
        </div>
        <div className="w-full max-w-2xl">
          <BatchDropzone disabled={batchLoading} onFiles={(files) => void addFiles(files)} />
        </div>
        {batchError && (
          <p role="alert" className="w-full max-w-2xl rounded-xl border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm text-red-200">
            {batchError}
          </p>
        )}
        <VisualGrid
          frame={frame}
          pictures={pictures}
          loading={batchLoading}
          cropMode={cropMode}
          onCropModeChange={setCropMode}
          onClear={clearBatch}
        />
      </div>
    </main>
  )
}
