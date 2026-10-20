import { describe, expect, it, vi } from 'vitest'
import {
  createJsZipArchive,
  defaultArchiveName,
  runBatchExport,
  sanitizeArchiveName,
  uniqueArchiveName,
  type BatchExportPicture,
  type PictureRenderer,
  type RenderPictureJob,
  type ZipArchiveWriter,
} from './batchExport'
import type { StoredFrame } from './frameStore'

const frame: StoredFrame = {
  dataUrl: 'data:image/png;base64,FRAME',
  width: 1080,
  height: 1920,
  aperture: { x: 120, y: 200, width: 840, height: 1260 },
}

function picture(name: string): BatchExportPicture {
  return {
    id: name,
    name,
    file: new File(['x'], name, { type: 'image/jpeg' }),
    cropMode: 'crop-to-fill',
    focalPoint: { x: 0.4, y: 0.3 },
    adjustment: { panX: 0.1, panY: 0, zoom: 1.5, rotation: 90 },
  }
}

function fakeRenderer(render = vi.fn(async (job: RenderPictureJob) => new Blob([job.file.name]))): PictureRenderer {
  return { render, dispose: vi.fn() }
}

function fakeArchive() {
  const entries: Array<[string, Blob]> = []
  const writer: ZipArchiveWriter = {
    addFile: vi.fn(async (name: string, blob: Blob) => {
      entries.push([name, blob])
    }),
    finish: vi.fn(async () => new Blob(['zip'], { type: 'application/zip' })),
  }
  return { writer, entries, createArchive: vi.fn(async () => writer) }
}

describe('archive naming', () => {
  it('pre-fills the default archive name from the local date', () => {
    expect(defaultArchiveName(new Date(2026, 9, 20))).toBe('framerly-2026-10-20.zip')
  })

  it('falls back to the dated archive name when the field is empty', () => {
    expect(sanitizeArchiveName('', 'framerly-2026-10-20.zip')).toBe('framerly-2026-10-20.zip')
  })

  it('appends .zip when the name does not already end with it', () => {
    expect(sanitizeArchiveName('summer-event', 'fallback.zip')).toBe('summer-event.zip')
    expect(sanitizeArchiveName('summer-event.ZIP', 'fallback.zip')).toBe('summer-event.ZIP')
  })

  it('strips path separators and Windows-illegal characters', () => {
    expect(sanitizeArchiveName('event/2026-pictures?*<>|"\\', 'fallback.zip')).toBe(
      'event2026-pictures.zip',
    )
  })

  it('gives duplicate names a numbered suffix before the extension', () => {
    expect(uniqueArchiveName('IMG_0412.jpg', new Set())).toBe('IMG_0412.jpg')
    expect(uniqueArchiveName('IMG_0412.jpg', new Set(['img_0412.jpg']))).toBe('IMG_0412 (2).jpg')
    expect(
      uniqueArchiveName('IMG_0412.jpg', new Set(['IMG_0412.jpg', 'IMG_0412 (2).jpg'])),
    ).toBe('IMG_0412 (3).jpg')
    expect(uniqueArchiveName('no-extension', new Set(['no-extension']))).toBe('no-extension (2)')
  })
})

describe('runBatchExport', () => {
  it('renders one Picture at a time and reports live progress', async () => {
    let active = 0
    let maxActive = 0
    const renderer = fakeRenderer(
      vi.fn(async (job: RenderPictureJob) => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await Promise.resolve()
        active -= 1
        return new Blob([job.file.name])
      }),
    )
    const progress: Array<{ processed: number; total: number; currentName: string }> = []
    const onPackaging = vi.fn()

    await runBatchExport(
      {
        pictures: [picture('a.jpg'), picture('b.jpg')],
        frame,
        archiveName: 'batch.zip',
      },
      {
        renderer,
        createArchive: fakeArchive().createArchive,
        triggerDownload: vi.fn(),
        onProgress: (value) => progress.push(value),
        onPackaging,
      },
    )

    expect(maxActive).toBe(1)
    expect(progress).toEqual([
      { processed: 0, total: 2, currentName: 'a.jpg' },
      { processed: 1, total: 2, currentName: 'a.jpg' },
      { processed: 1, total: 2, currentName: 'b.jpg' },
      { processed: 2, total: 2, currentName: 'b.jpg' },
    ])
    expect(onPackaging).toHaveBeenCalledTimes(1)
  })

  it('packs exact original filenames into the archive and downloads it', async () => {
    const archive = fakeArchive()
    const triggerDownload = vi.fn()
    const renderer = fakeRenderer()

    const result = await runBatchExport(
      { pictures: [picture('IMG_0412.jpg')], frame, archiveName: 'batch.zip' },
      { renderer, createArchive: archive.createArchive, triggerDownload },
    )

    expect(archive.entries.map(([name]) => name)).toEqual(['IMG_0412.jpg'])
    expect(archive.writer.finish).toHaveBeenCalledTimes(1)
    expect(triggerDownload).toHaveBeenCalledWith(expect.any(Blob), 'batch.zip')
    expect(result).toMatchObject({ status: 'completed', downloaded: true, succeeded: 1, total: 1 })
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
  })

  it('renames duplicate filenames and reports every rename', async () => {
    const archive = fakeArchive()
    const result = await runBatchExport(
      {
        pictures: [picture('IMG_0412.jpg'), picture('IMG_0412.jpg')],
        frame,
        archiveName: 'batch.zip',
      },
      {
        renderer: fakeRenderer(),
        createArchive: archive.createArchive,
        triggerDownload: vi.fn(),
      },
    )

    expect(archive.entries.map(([name]) => name)).toEqual(['IMG_0412.jpg', 'IMG_0412 (2).jpg'])
    expect(result.renamed).toEqual([{ original: 'IMG_0412.jpg', assigned: 'IMG_0412 (2).jpg' }])
  })

  it('continues past a failed Picture and still downloads the successes', async () => {
    const archive = fakeArchive()
    const triggerDownload = vi.fn()
    const render = vi.fn(async (job: RenderPictureJob) => {
      if (job.file.name === 'broken.jpg') throw new Error('Could not decode Picture')
      return new Blob([job.file.name])
    })
    const result = await runBatchExport(
      {
        pictures: [picture('a.jpg'), picture('broken.jpg'), picture('c.jpg')],
        frame,
        archiveName: 'batch.zip',
      },
      {
        renderer: fakeRenderer(render),
        createArchive: archive.createArchive,
        triggerDownload,
      },
    )

    expect(archive.entries.map(([name]) => name)).toEqual(['a.jpg', 'c.jpg'])
    expect(triggerDownload).toHaveBeenCalledTimes(1)
    expect(result.failed).toEqual([{ name: 'broken.jpg', message: 'Could not decode Picture' }])
    expect(result).toMatchObject({ status: 'completed', downloaded: true, succeeded: 2, total: 3 })
  })

  it('does not download an archive when every Picture failed', async () => {
    const archive = fakeArchive()
    const triggerDownload = vi.fn()
    const result = await runBatchExport(
      { pictures: [picture('broken.jpg')], frame, archiveName: 'batch.zip' },
      {
        renderer: fakeRenderer(
          vi.fn(async () => {
            throw new Error('nope')
          }),
        ),
        createArchive: archive.createArchive,
        triggerDownload,
      },
    )

    expect(archive.createArchive).not.toHaveBeenCalled()
    expect(triggerDownload).not.toHaveBeenCalled()
    expect(result).toMatchObject({ status: 'completed', downloaded: false, succeeded: 0 })
    expect(result.failed).toHaveLength(1)
  })

  it('stops between Pictures when cancelled and discards the partial archive', async () => {
    const controller = new AbortController()
    const archive = fakeArchive()
    const triggerDownload = vi.fn()
    const render = vi.fn(async (job: RenderPictureJob) => {
      controller.abort()
      return new Blob([job.file.name])
    })

    const result = await runBatchExport(
      {
        pictures: [picture('a.jpg'), picture('b.jpg')],
        frame,
        archiveName: 'batch.zip',
        signal: controller.signal,
      },
      {
        renderer: fakeRenderer(render),
        createArchive: archive.createArchive,
        triggerDownload,
      },
    )

    expect(render).toHaveBeenCalledTimes(1)
    expect(archive.createArchive).not.toHaveBeenCalled()
    expect(triggerDownload).not.toHaveBeenCalled()
    expect(result).toMatchObject({ status: 'cancelled', downloaded: false })
  })

  it('renders JPEG by default and PNG when requested', async () => {
    const render = vi.fn(async (_job: RenderPictureJob) => new Blob(['out']))
    await runBatchExport(
      { pictures: [picture('a.jpg')], frame, archiveName: 'batch.zip', format: 'jpeg' },
      {
        renderer: fakeRenderer(render),
        createArchive: fakeArchive().createArchive,
        triggerDownload: vi.fn(),
      },
    )
    expect(render.mock.calls[0][0].format).toBe('jpeg')

    await runBatchExport(
      { pictures: [picture('b.jpg')], frame, archiveName: 'batch.zip', format: 'png' },
      {
        renderer: fakeRenderer(render),
        createArchive: fakeArchive().createArchive,
        triggerDownload: vi.fn(),
      },
    )
    expect(render.mock.calls[1][0].format).toBe('png')
  })

  it('passes the current adjustment, Crop Mode, and focal point to the renderer', async () => {
    const render = vi.fn(async (_job: RenderPictureJob) => new Blob(['out']))
    await runBatchExport(
      { pictures: [picture('a.jpg')], frame, archiveName: 'batch.zip' },
      {
        renderer: fakeRenderer(render),
        createArchive: fakeArchive().createArchive,
        triggerDownload: vi.fn(),
      },
    )

    expect(render.mock.calls[0][0]).toMatchObject({
      cropMode: 'crop-to-fill',
      focalPoint: { x: 0.4, y: 0.3 },
      adjustment: { panX: 0.1, panY: 0, zoom: 1.5, rotation: 90 },
      frame,
    } satisfies Partial<RenderPictureJob>)
  })
})

describe('createJsZipArchive', () => {
  it('adds files and finishes a real ZIP archive', async () => {
    const archive = await createJsZipArchive()
    await archive.addFile('IMG_0412.jpg', new Blob(['jpeg-bytes']))
    await archive.addFile('IMG_0413.png', new Blob(['png-bytes']))
    const blob = await archive.finish()

    const { default: JSZip } = await import('jszip')
    const loaded = await JSZip.loadAsync(await blobToArrayBuffer(blob))
    expect(Object.keys(loaded.files).sort()).toEqual(['IMG_0412.jpg', 'IMG_0413.png'])
  })
})

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}
