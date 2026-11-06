import { useCallback, useRef, useState } from 'react'
import { filterPictureFiles } from '../lib/batchIngest'
import {
  batchReducer,
  type BatchPicture,
  type BatchState,
} from '../lib/batchState'
import { decodePictureFile } from '../lib/pictureDecode'
import { extractExifFromBlob } from '../lib/exif'
import { DEFAULT_ADJUSTMENT, type AdjustmentInput } from '../lib/framing'

export type { BatchPicture, BatchPictureStatus } from '../lib/batchState'

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
      const names = files.map((file) => file.name).join(', ')
      setError(names ? `Could not read Frame or Picture files ${names}. No supported Pictures found. Use JPG, PNG, WebP, or HEIC.` : 'No supported Pictures found. Use JPG, PNG, WebP, or HEIC.')
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
    // Extract EXIF APP1 segments from JPEG files during ingest so the
    // preserved metadata can be re-injected at export. Non-JPEG files
    // (PNG, WebP, HEIC) return an empty segment without error.
    for (const placeholder of placeholders) {
      if (!placeholder.file) continue
      try {
        const extraction = await extractExifFromBlob(placeholder.file)
        if (extraction.segment) {
          placeholder.exifSegment = extraction.segment
          placeholder.exif = extraction.metadata
        }
      } catch {
        // Malformed or non-JPEG files simply carry no preserved metadata.
      }
    }
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
                  exifSegment: settled.value.exifSegment ?? picture.exifSegment,
                  exif: settled.value.exif ?? picture.exif,
                }
              }
              return {
                ...picture,
                status: 'error' as const,
                error:
                  settled.reason instanceof Error && settled.reason.message.includes(picture.name)
                    ? settled.reason.message
                    : settled.reason instanceof Error
                      ? `Could not read Picture ${picture.name}: ${settled.reason.message}`
                      : `Could not read Picture ${picture.name}`,
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
