import { useCallback, useEffect, useRef, useState } from 'react'
import { AdjustmentModal } from './components/AdjustmentModal'
import { BatchDropzone } from './components/BatchDropzone'
import { BatchExportDialog } from './components/BatchExportDialog'
import { BatchExportProgress } from './components/BatchExportProgress'
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
import type { AdjustmentInput, CropMode } from './lib/framing'
import { downloadFramedPicture } from './lib/pictureExport'
import {
  runBatchExport,
  type BatchExportFailure,
  type BatchExportProgressState,
  type BatchExportResult,
} from './lib/batchExport'
import type { PictureExportFormat } from './lib/exportFormat'
import { isReadyPicture } from './lib/batchState'
import { useBatchIngest } from './lib/useBatchIngest'

function pictureCountLabel(count: number): string {
  return `${count} Picture${count === 1 ? '' : 's'}`
}

function describeBatchExportResult(result: BatchExportResult): string {
  if (result.status === 'cancelled') {
    return `Batch Export cancelled after ${result.processed} of ${pictureCountLabel(result.total)}. No archive was downloaded.`
  }

  const failedNames = result.failed.map((failure) => failure.name).join(', ')

  if (result.succeeded === 0) {
    return `No Pictures were exported. Failed: ${failedNames}.`
  }

  const parts = [
    `Exported ${result.succeeded} of ${pictureCountLabel(result.total)} to ${result.archiveName}.`,
  ]
  if (result.renamed.length > 0) {
    const renames = result.renamed
      .map((rename) => `${rename.original} → ${rename.assigned}`)
      .join(', ')
    parts.push(`Duplicate filenames renamed: ${renames}.`)
  }
  if (result.failed.length > 0) {
    parts.push(`Failed to export: ${failedNames}.`)
  }
  return parts.join(' ')
}

/**
 * App: top-level wiring for the framing workflow: the FrameUploader, the
 * Batch Dropzone, the Visual Grid with the global Crop Mode toggle, and the
 * Adjustment Modal for one Picture. Owns Frame persistence and download
 * error notices.
 */
export default function App() {
  const [frame, setFrame] = useState<StoredFrame | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cropMode, setCropMode] = useState<CropMode>('crop-to-fill')
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [namingExport, setNamingExport] = useState(false)
  const [namingExportOpener, setNamingExportOpener] = useState<HTMLElement | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportPhase, setExportPhase] = useState<'rendering' | 'packaging'>('rendering')
  const [exportProgress, setExportProgress] = useState<BatchExportProgressState | null>(null)
  const [cancelRequested, setCancelRequested] = useState(false)
  const exportAbortRef = useRef<AbortController | null>(null)
  const {
    pictures,
    loading: batchLoading,
    error: batchError,
    addFiles,
    clearBatch,
    adjustPicture,
    resetPicture,
    removePicture,
  } = useBatchIngest()

  const adjustingPicture = pictures.find((picture) => picture.id === adjustingId) ?? null
  const readyPictures = pictures.filter(isReadyPicture)
  const batchExportDisabled =
    adjustingPicture !== null || batchLoading || exporting || !frame || readyPictures.length === 0

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

  const handleAdjust = useCallback(
    (adjustment: AdjustmentInput) => {
      if (adjustingId) adjustPicture(adjustingId, adjustment)
    },
    [adjustingId, adjustPicture],
  )

  const handleReset = useCallback(() => {
    if (adjustingId) resetPicture(adjustingId)
  }, [adjustingId, resetPicture])

  const handleRemove = useCallback(
    (id: string) => {
      removePicture(id)
      setAdjustingId((current) => (current === id ? null : current))
    },
    [removePicture],
  )

  const handleOpenAdjustment = useCallback(
    (id: string) => {
      if (!exporting) setAdjustingId(id)
    },
    [exporting],
  )

  const handleOpenExportDialog = useCallback((trigger: HTMLButtonElement) => {
    setNamingExportOpener(trigger)
    setNamingExport(true)
  }, [])

  const handleStartExport = useCallback(
    (archiveName: string, format: PictureExportFormat) => {
      if (!frame) return
      const batchPictures = pictures.filter(isReadyPicture).map((picture) => ({
        id: picture.id,
        name: picture.name,
        file: picture.file,
        cropMode,
        focalPoint: picture.focalPoint,
        adjustment: picture.adjustment,
      }))
      if (batchPictures.length === 0) return
      const ingestFailures: BatchExportFailure[] = pictures.flatMap((picture) =>
        picture.status === 'error'
          ? [{ name: picture.name, message: picture.error ?? 'Could not read Picture' }]
          : [],
      )
      // The progress bar and the completion notice must show the same total.
      const exportTotal = batchPictures.length + ingestFailures.length

      const controller = new AbortController()
      exportAbortRef.current = controller
      setNamingExport(false)
      setExporting(true)
      setExportPhase('rendering')
      setCancelRequested(false)
      setExportProgress({
        processed: 0,
        total: exportTotal,
        currentName: batchPictures[0].name,
      })
      setNotice(null)

      void (async () => {
        try {
          const result = await runBatchExport(
            {
              pictures: batchPictures,
              frame,
              archiveName,
              format,
              signal: controller.signal,
            },
            {
              onProgress: (progress) =>
                setExportProgress({ ...progress, total: exportTotal }),
              onPackaging: () => setExportPhase('packaging'),
            },
          )
          const noticeResult =
            result.status === 'completed' && ingestFailures.length > 0
              ? {
                  ...result,
                  total: result.total + ingestFailures.length,
                  failed: [...ingestFailures, ...result.failed],
                }
              : result
          setNotice(describeBatchExportResult(noticeResult))
        } catch (e) {
          setNotice(`Batch Export failed: ${e instanceof Error ? e.message : 'unknown error'}`)
        } finally {
          exportAbortRef.current = null
          setExporting(false)
          setExportProgress(null)
          setCancelRequested(false)
        }
      })()
    },
    [cropMode, frame, pictures],
  )

  const handleCancelExport = useCallback(() => {
    exportAbortRef.current?.abort()
    setCancelRequested(true)
  }, [])

  const handleDownload = useCallback(
    async (id: string) => {
      const picture = pictures.find((candidate) => candidate.id === id)
      if (!picture) return
      if (!frame) {
        setNotice(`Could not download ${picture.name}: upload a Frame first.`)
        return
      }
      if (!picture.file) {
        setNotice(`Could not download ${picture.name}: the original file is no longer in memory.`)
        return
      }
      setNotice(null)
      try {
        await downloadFramedPicture({
          file: picture.file,
          frame,
          cropMode,
          focalPoint: picture.focalPoint,
          adjustment: picture.adjustment,
        })
      } catch (e) {
        // Keep the Adjustment Modal open so no work is lost.
        setNotice(
          `Could not download ${picture.name}: ${e instanceof Error ? e.message : 'unknown error'}`,
        )
      }
    },
    [cropMode, frame, pictures],
  )

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
        {notice && !adjustingPicture && (
          <p role="alert" className="w-full max-w-2xl rounded-xl border border-amber-500/40 bg-amber-950/60 px-4 py-3 text-sm text-amber-100">
            {notice}
          </p>
        )}
        {exporting && exportProgress && (
          <BatchExportProgress
            progress={exportProgress}
            phase={exportPhase}
            cancelRequested={cancelRequested}
            onCancel={exportPhase === 'rendering' ? handleCancelExport : undefined}
          />
        )}
        <VisualGrid
          frame={frame}
          pictures={pictures}
          loading={batchLoading}
          cropMode={cropMode}
          clearDisabled={adjustingPicture !== null || exporting}
          adjustDisabled={exporting}
          batchExportDisabled={batchExportDisabled}
          onCropModeChange={setCropMode}
          onOpenAdjustment={handleOpenAdjustment}
          onRemove={handleRemove}
          onDownload={(id) => void handleDownload(id)}
          onBatchExport={handleOpenExportDialog}
          onClear={clearBatch}
        />
      </div>

      {namingExport && (
        <BatchExportDialog
          returnFocusTo={namingExportOpener}
          onConfirm={handleStartExport}
          onClose={() => setNamingExport(false)}
        />
      )}

      {adjustingPicture && (
        <AdjustmentModal
          picture={adjustingPicture}
          frame={frame}
          cropMode={cropMode}
          notice={notice}
          onAdjust={handleAdjust}
          onReset={handleReset}
          onDownload={() => void handleDownload(adjustingPicture.id)}
          onClose={() => setAdjustingId(null)}
        />
      )}
    </main>
  )
}
