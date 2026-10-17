import { useCallback, useState } from 'react'
import { filterPictureFiles } from './batchIngest'
import {
  batchReducer,
  type BatchPicture,
  type BatchState,
} from './batchState'
import { decodePictureFile } from './pictureDecode'
import { DEFAULT_ADJUSTMENT, type AdjustmentInput } from './framing'

export type { BatchPicture, BatchPictureStatus } from './batchState'

function makeId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
  }
}

const CONCURRENCY = 4

/** Batch state: lightweight ~800px Framed Picture previews, full sources released. */
export function useBatchIngest() {
  const [state, setState] = useState<BatchState>({ pictures: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearBatch = useCallback(() => {
    setState({ pictures: [] })
    setError(null)
  }, [])

  const adjustPicture = useCallback((id: string, adjustment: AdjustmentInput) => {
    setState((prev) => batchReducer(prev, { type: 'adjust', id, adjustment }))
  }, [])

  const resetPicture = useCallback((id: string) => {
    setState((prev) => batchReducer(prev, { type: 'reset', id }))
  }, [])

  const removePicture = useCallback((id: string) => {
    setState((prev) => batchReducer(prev, { type: 'remove', id }))
  }, [])

  const addFiles = useCallback(async (files: File[]) => {
    const supported = filterPictureFiles(files)
    if (supported.length === 0) {
      setError('No supported Pictures found. Use JPG, PNG, WebP, or HEIC.')
      return
    }
    setError(null)
    const placeholders: BatchPicture[] = supported.map((file) => ({
      id: makeId(),
      name: file.name,
      width: 0,
      height: 0,
      previewUrl: '',
      status: 'loading' as const,
      file,
      adjustment: DEFAULT_ADJUSTMENT,
    }))
    setState((prev) => batchReducer(prev, { type: 'set', pictures: [...prev.pictures, ...placeholders] }))
    setLoading(true)
    try {
      for (let i = 0; i < supported.length; i += CONCURRENCY) {
        const chunk = supported.slice(i, i + CONCURRENCY)
        const chunkIds = placeholders.slice(i, i + CONCURRENCY).map((p) => p.id)
        const results = await Promise.allSettled(chunk.map((file) => decodePictureFile(file)))
        setState((prev) =>
          batchReducer(prev, {
            type: 'set',
            pictures: prev.pictures.map((picture) => {
              const index = chunkIds.indexOf(picture.id)
              if (index === -1) return picture
              const settled = results[index]
              if (settled.status === 'fulfilled') {
                return {
                  ...picture,
                  width: settled.value.width,
                  height: settled.value.height,
                  previewUrl: settled.value.previewUrl,
                  status: 'ready' as const,
                  focalPoint: settled.value.focalPoint,
                }
              }
              return {
                ...picture,
                status: 'error' as const,
                error: settled.reason instanceof Error ? settled.reason.message : 'Could not read Picture',
              }
            }),
          }),
        )
      }
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    pictures: state.pictures,
    loading,
    error,
    addFiles,
    clearBatch,
    adjustPicture,
    resetPicture,
    removePicture,
  }
}
