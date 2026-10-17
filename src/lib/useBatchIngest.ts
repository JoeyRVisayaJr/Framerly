import { useCallback, useRef, useState } from 'react'
import { filterPictureFiles } from './batchIngest'
import {
  batchReducer,
  type BatchPicture,
  type BatchState,
} from './batchState'
import { decodePictureFile } from './pictureDecode'
import { DEFAULT_ADJUSTMENT, type AdjustmentInput } from './framing'

export type { BatchPicture, BatchPictureStatus } from './batchState'

type DecodedPictureResult = Awaited<ReturnType<typeof decodePictureFile>>

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
  /** Active addFiles runs; loading stays on until every concurrent run drains. */
  const runsRef = useRef(0)
  /**
   * Incremented by clearBatch so in-flight decode runs of a cleared Batch
   * discard their results instead of decoding into stale state.
   */
  const generationRef = useRef(0)

  const clearBatch = useCallback(() => {
    generationRef.current += 1
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
    const generation = generationRef.current
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
    runsRef.current += 1
    setLoading(true)
    try {
      for (let i = 0; i < placeholders.length; i += CONCURRENCY) {
        if (generationRef.current !== generation) return // Batch cleared mid-decode
        const chunk = placeholders.slice(i, i + CONCURRENCY)
        const results = await Promise.allSettled(
          chunk.map((placeholder) => decodePictureFile(placeholder.file!)),
        )
        if (generationRef.current !== generation) return // Batch cleared mid-decode
        // Map id -> settled result so resolving stays O(N) over the whole Batch
        // instead of rescanning every Picture per chunk.
        const settledById = new Map<string, PromiseSettledResult<DecodedPictureResult>>(
          chunk.map((placeholder, index) => [placeholder.id, results[index]]),
        )
        setState((prev) =>
          batchReducer(prev, {
            type: 'set',
            pictures: prev.pictures.map((picture) => {
              const settled = settledById.get(picture.id)
              if (!settled) return picture
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
      runsRef.current -= 1
      if (runsRef.current === 0) setLoading(false)
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
