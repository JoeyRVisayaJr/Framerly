import { useCallback, useEffect, useState } from 'react'
import { FrameUploader } from './components/FrameUploader'
import {
  clearFrame,
  decodeFrameFile,
  isPngFile,
  loadFrame,
  saveFrame,
  type StoredFrame,
} from './lib/frameStore'

export default function App() {
  const [frame, setFrame] = useState<StoredFrame | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    </main>
  )
}
