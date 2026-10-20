import { isHeicFile } from './batchIngest'
import { convertHeicFile } from './pictureDecode'
import { renderFramedPictureFile, triggerDownloadDefault } from './pictureExport'
import type { PictureExportFormat } from './exportFormat'
import type { AdjustmentInput, CropMode } from './framing'
import type { StoredFrame } from './frameStore'
import type { FocalPoint } from './subjectDetection'
import type { WorkerRenderRequest, WorkerRenderResponse } from './batchExportProtocol'

/** The smallest archive surface the Batch Export needs; swap implementations without touching the pipeline. */
export interface ZipArchiveWriter {
  /** Add one Framed Picture under its final archive filename. */
  addFile(name: string, blob: Blob): void | Promise<void>
  /** Compile and return the finished ZIP archive. */
  finish(): Promise<Blob>
}

/** One Picture handed to a renderer at full Frame resolution. */
export interface RenderPictureJob {
  file: File
  frame: StoredFrame
  cropMode?: CropMode
  focalPoint?: FocalPoint
  adjustment?: AdjustmentInput
  format: PictureExportFormat
}

/** Renders Framed Pictures one at a time and can release its resources after a run. */
export interface PictureRenderer {
  /** Render one Picture at the Frame's exact pixel dimensions and encode it in the run's format. */
  render(job: RenderPictureJob): Promise<Blob>
  /** Release workers or other resources once the Batch Export finishes or is cancelled. */
  dispose(): void
}

/** One Picture in a Batch Export run. */
export interface BatchExportPicture {
  id: string
  name: string
  file: File
  cropMode?: CropMode
  focalPoint?: FocalPoint
  adjustment?: AdjustmentInput
}

/** Input for one complete Batch Export. */
export interface BatchExportInput {
  pictures: BatchExportPicture[]
  frame: StoredFrame
  /** Final ZIP filename, already sanitized by the naming dialog. */
  archiveName: string
  /** Output encoding for every Picture in this run. Defaults to high-quality JPEG. */
  format?: PictureExportFormat
  /** Aborting stops the run between Pictures and discards the partial archive. */
  signal?: AbortSignal
}

/** Live rendering progress for the Batch Export progress bar. */
export interface BatchExportProgressState {
  processed: number
  total: number
  currentName: string
}

/** A Picture that could not be rendered, named for the completion notice. */
export interface BatchExportFailure {
  name: string
  message: string
}

/** A duplicate original filename that was given a numbered suffix inside the archive. */
export interface BatchExportRename {
  original: string
  assigned: string
}

/** Outcome of a Batch Export run. */
export interface BatchExportResult {
  status: 'completed' | 'cancelled'
  archiveName: string
  total: number
  processed: number
  succeeded: number
  failed: BatchExportFailure[]
  renamed: BatchExportRename[]
  downloaded: boolean
}

/** Injectable boundaries for the Batch Export pipeline. */
export interface BatchExportDeps {
  /** Renderer to use for this run. Defaults to a Worker with main-thread fallback. */
  renderer?: PictureRenderer
  /** Archive factory. Defaults to the lazy-loaded JSZip writer. */
  createArchive?: () => Promise<ZipArchiveWriter>
  /** Download trigger called once the archive is compiled. */
  triggerDownload?: (blob: Blob, filename: string) => void
  /** Called before and after each Picture with live progress. */
  onProgress?: (progress: BatchExportProgressState) => void
  /** Called when rendering finishes and ZIP compilation begins. */
  onPackaging?: () => void
}

const ILLEGAL_ARCHIVE_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g

function localDateStamp(now: Date): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** The default archive name, `framerly-<YYYY-MM-DD>.zip`, using the local date. */
export function defaultArchiveName(now: Date = new Date()): string {
  return `framerly-${localDateStamp(now)}.zip`
}

/**
 * Sanitize a user-supplied archive name: strip path separators and
 * Windows-illegal characters, trim trailing dots/spaces, append `.zip` when
 * missing, and fall back to `fallback` when nothing usable remains.
 */
export function sanitizeArchiveName(raw: string, fallback: string): string {
  let name = raw.replace(ILLEGAL_ARCHIVE_CHARS, '').trim().replace(/[. ]+$/g, '')
  if (!name) name = fallback
  if (!/\.zip$/i.test(name)) name += '.zip'
  return name
}

function splitExtension(name: string): [base: string, extension: string] {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return [name, '']
  return [name.slice(0, dot), name.slice(dot)]
}

/**
 * Return `name`, or `name (2).jpg`-style when it is already taken.
 * Comparison is case-insensitive because ZIP entries collide on Windows.
 */
export function uniqueArchiveName(name: string, used: ReadonlySet<string>): string {
  const taken = new Set(Array.from(used, (entry) => entry.toLowerCase()))
  if (!taken.has(name.toLowerCase())) return name
  const [base, extension] = splitExtension(name)
  let suffix = 2
  while (taken.has(`${base} (${suffix})${extension}`.toLowerCase())) suffix += 1
  return `${base} (${suffix})${extension}`
}

/** JSZip archive writer, imported lazily so JSZip stays out of the main bundle. */
export async function createJsZipArchive(): Promise<ZipArchiveWriter> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  return {
    addFile(name: string, blob: Blob): void {
      zip.file(name, blob)
    },
    finish(): Promise<Blob> {
      return zip.generateAsync({ type: 'blob' })
    },
  }
}

/** True when the current browser can render in a Web Worker with `OffscreenCanvas`. */
export function canUseWorkerRendering(): boolean {
  if (
    typeof Worker === 'undefined' ||
    typeof OffscreenCanvas === 'undefined' ||
    typeof createImageBitmap !== 'function'
  ) {
    return false
  }
  try {
    return new OffscreenCanvas(1, 1).getContext('2d') !== null
  } catch {
    return false
  }
}

/** Raised when the background Worker itself failed, not when one Picture failed to render. */
export class WorkerRendererUnavailableError extends Error {
  constructor(message = 'The background renderer is unavailable') {
    super(message)
    this.name = 'WorkerRendererUnavailableError'
  }
}

/**
 * Create the OffscreenCanvas Web Worker renderer, or null when the browser
 * lacks the capability (the caller falls back to the main-thread renderer).
 */
export function createWorkerPictureRenderer(): PictureRenderer | null {
  if (!canUseWorkerRendering()) return null

  let worker: Worker
  try {
    // A classic Worker keeps the Firefox 105 floor (module workers arrived in 114).
    worker = new Worker(new URL('./batchExport.worker.ts', import.meta.url))
  } catch {
    return null
  }

  let nextId = 1
  let broken = false
  const pending = new Map<number, { resolve: (blob: Blob) => void; reject: (error: Error) => void }>()

  function failWorker(message: string): void {
    broken = true
    const error = new WorkerRendererUnavailableError(message)
    for (const { reject } of pending.values()) reject(error)
    pending.clear()
  }

  worker.addEventListener('message', (event: MessageEvent<WorkerRenderResponse>) => {
    const response = event.data
    const request = pending.get(response.id)
    if (!request) return
    pending.delete(response.id)
    if ('error' in response) request.reject(new Error(response.error))
    else request.resolve(response.blob)
  })
  worker.addEventListener('error', (event) => {
    failWorker(event.message || 'The background renderer failed')
  })

  return {
    async render(job: RenderPictureJob): Promise<Blob> {
      if (broken) {
        throw new WorkerRendererUnavailableError()
      }
      // heic2any needs the DOM, so HEIC Pictures are converted on the main
      // thread before the bytes are handed to the Worker.
      const source: Blob = isHeicFile(job.file) ? await convertHeicFile(job.file) : job.file
      const id = nextId
      nextId += 1
      return new Promise<Blob>((resolve, reject) => {
        pending.set(id, { resolve, reject })
        const request: WorkerRenderRequest = {
          id,
          source,
          frame: job.frame,
          cropMode: job.cropMode,
          focalPoint: job.focalPoint,
          adjustment: job.adjustment,
          format: job.format,
        }
        try {
          worker.postMessage(request)
        } catch (error) {
          pending.delete(id)
          broken = true
          reject(
            new WorkerRendererUnavailableError(
              error instanceof Error ? error.message : 'Could not reach the background renderer',
            ),
          )
        }
      })
    },
    dispose(): void {
      worker.terminate()
      const error = new WorkerRendererUnavailableError('Batch Export stopped')
      for (const { reject } of pending.values()) reject(error)
      pending.clear()
    },
  }
}

/** The main-thread renderer used for capability fallback and tests. */
export function createMainThreadPictureRenderer(): PictureRenderer {
  return {
    async render(job: RenderPictureJob): Promise<Blob> {
      const { blob } = await renderFramedPictureFile({
        file: job.file,
        frame: job.frame,
        cropMode: job.cropMode,
        focalPoint: job.focalPoint,
        adjustment: job.adjustment,
        format: job.format,
      })
      return blob
    },
    dispose(): void {
      // No worker or canvas resources outlive a main-thread render.
    },
  }
}

/**
 * Prefer a background Worker; fall back to the main-thread renderer when the
 * capability is missing or the Worker dies, so a broken Worker never stalls
 * the rest of the Batch.
 */
export function createDefaultPictureRenderer(): PictureRenderer {
  const worker = createWorkerPictureRenderer()
  if (!worker) return createMainThreadPictureRenderer()

  const mainThread = createMainThreadPictureRenderer()
  let workerUsable = true

  return {
    async render(job: RenderPictureJob): Promise<Blob> {
      if (workerUsable) {
        try {
          return await worker.render(job)
        } catch (error) {
          if (!(error instanceof WorkerRendererUnavailableError)) throw error
          workerUsable = false
          worker.dispose()
        }
      }
      return mainThread.render(job)
    },
    dispose(): void {
      worker.dispose()
      mainThread.dispose()
    },
  }
}

function cancelledResult(
  input: BatchExportInput,
  processed: number,
  succeeded: number,
  failed: BatchExportFailure[],
  renamed: BatchExportRename[],
): BatchExportResult {
  return {
    status: 'cancelled',
    archiveName: input.archiveName,
    total: input.pictures.length,
    processed,
    succeeded,
    failed,
    renamed,
    downloaded: false,
  }
}

/**
 * Render every Picture at full resolution, one at a time, then compile the
 * successes into one ZIP archive and trigger its download. A failed Picture is
 * recorded and skipped so the rest of the Batch still completes; cancellation
 * is checked between Pictures and before packaging so no partial archive is
 * downloaded.
 */
export async function runBatchExport(
  input: BatchExportInput,
  deps: BatchExportDeps = {},
): Promise<BatchExportResult> {
  const {
    renderer = createDefaultPictureRenderer(),
    createArchive = createJsZipArchive,
    triggerDownload = triggerDownloadDefault,
    onProgress,
    onPackaging,
  } = deps

  const total = input.pictures.length
  const format = input.format ?? 'jpeg'
  const usedNames = new Set<string>()
  const completed: Array<{ name: string; blob: Blob }> = []
  const failed: BatchExportFailure[] = []
  const renamed: BatchExportRename[] = []
  let processed = 0

  try {
    for (const picture of input.pictures) {
      if (input.signal?.aborted) {
        return cancelledResult(input, processed, completed.length, failed, renamed)
      }

      onProgress?.({ processed, total, currentName: picture.name })

      try {
        const blob = await renderer.render({
          file: picture.file,
          frame: input.frame,
          cropMode: picture.cropMode,
          focalPoint: picture.focalPoint,
          adjustment: picture.adjustment,
          format,
        })
        const assigned = uniqueArchiveName(picture.name, usedNames)
        usedNames.add(assigned)
        if (assigned !== picture.name) {
          renamed.push({ original: picture.name, assigned })
        }
        completed.push({ name: assigned, blob })
      } catch (error) {
        failed.push({
          name: picture.name,
          message: error instanceof Error ? error.message : 'Could not render Picture',
        })
      }

      processed += 1
      onProgress?.({ processed, total, currentName: picture.name })
    }

    if (input.signal?.aborted) {
      return cancelledResult(input, processed, completed.length, failed, renamed)
    }

    if (completed.length === 0) {
      return {
        status: 'completed',
        archiveName: input.archiveName,
        total,
        processed,
        succeeded: 0,
        failed,
        renamed,
        downloaded: false,
      }
    }

    onPackaging?.()
    const archive = await createArchive()
    for (const entry of completed) {
      await archive.addFile(entry.name, entry.blob)
    }

    if (input.signal?.aborted) {
      return cancelledResult(input, processed, completed.length, failed, renamed)
    }

    const blob = await archive.finish()

    if (input.signal?.aborted) {
      return cancelledResult(input, processed, completed.length, failed, renamed)
    }

    triggerDownload(blob, input.archiveName)
    return {
      status: 'completed',
      archiveName: input.archiveName,
      total,
      processed,
      succeeded: completed.length,
      failed,
      renamed,
      downloaded: true,
    }
  } finally {
    renderer.dispose()
  }
}
