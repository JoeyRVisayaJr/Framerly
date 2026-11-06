import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBatchIngest } from './useBatchIngest'
import { decodePictureFile, type DecodedPicture } from '../lib/pictureDecode'

vi.mock('../lib/pictureDecode', () => ({ decodePictureFile: vi.fn() }))
vi.mock('../lib/exif', () => ({
  extractExifFromBlob: vi.fn(async () => ({
    segment: null,
    metadata: {
      make: null,
      model: null,
      dateTimeOriginal: null,
      exposureTime: null,
      fNumber: null,
      iso: null,
      focalLength: null,
    },
  })),
  parseExifSegment: vi.fn(),
}))

const decoded: DecodedPicture = {
  name: 'a.jpg',
  width: 800,
  height: 600,
  previewUrl: 'data:image/jpeg;base64,PREVIEW',
  focalPoint: { x: 0.5, y: 0.4 },
}

function jpgFile(name: string): File {
  return new File(['x'], name, { type: 'image/jpeg' })
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void } {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useBatchIngest', () => {
  beforeEach(() => {
    vi.mocked(decodePictureFile).mockReset()
  })

  it('marks each Picture ready and drains loading after all chunks decode', async () => {
    vi.mocked(decodePictureFile).mockImplementation(async (file) => ({
      ...decoded,
      name: file.name,
    }))
    const { result } = renderHook(() => useBatchIngest())
    expect(result.current.loading).toBe(false)

    await act(async () => {
      await result.current.addFiles([jpgFile('a.jpg'), jpgFile('b.jpg')])
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.pictures.map((picture) => picture.status)).toEqual(['ready', 'ready'])
    expect(result.current.pictures[0].previewUrl).toBe('data:image/jpeg;base64,PREVIEW')
    expect(result.current.error).toBeNull()
  })

  it('marks a failed Picture as error while the rest of the chunk still loads', async () => {
    vi.mocked(decodePictureFile)
      .mockRejectedValueOnce(new Error('Could not read Picture broken.jpg'))
      .mockResolvedValueOnce(decoded)
    const { result } = renderHook(() => useBatchIngest())

    await act(async () => {
      await result.current.addFiles([jpgFile('broken.jpg'), jpgFile('ok.jpg')])
    })

    const [broken, ok] = result.current.pictures
    expect(broken.status).toBe('error')
    expect(broken.error).toBe('Could not read Picture broken.jpg')
    expect(ok.status).toBe('ready')
    expect(result.current.loading).toBe(false)
  })

  it('reports an error when no supported Pictures arrive', async () => {
    const { result } = renderHook(() => useBatchIngest())
    await act(async () => {
      await result.current.addFiles([new File(['x'], 'notes.txt', { type: 'text/plain' })])
    })
    expect(result.current.pictures).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toContain('No supported Pictures found. Use JPG, PNG, WebP, or HEIC.')
    expect(result.current.error).toContain('notes.txt')
  })

  it('stops decoding and drops loading when the Batch is cleared mid-run', async () => {
    const pending = deferred<DecodedPicture>()
    vi.mocked(decodePictureFile).mockImplementation(() => pending.promise)
    const { result } = renderHook(() => useBatchIngest())

    act(() => {
      void result.current.addFiles([jpgFile('a.jpg')])
    })
    await waitFor(() => expect(result.current.loading).toBe(true))

    act(() => {
      result.current.clearBatch()
    })
    // The decode settles afterwards, but the cleared generation discards it.
    await act(async () => {
      pending.resolve({ ...decoded })
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.pictures).toEqual([])
  })

  it('keeps loading until every overlapping run finishes', async () => {
    const first = deferred<DecodedPicture>()
    const second = deferred<DecodedPicture>()
    vi.mocked(decodePictureFile).mockImplementationOnce(() => first.promise)
    vi.mocked(decodePictureFile).mockImplementationOnce(() => second.promise)
    const { result } = renderHook(() => useBatchIngest())

    act(() => {
      void result.current.addFiles([jpgFile('a.jpg')])
    })
    act(() => {
      void result.current.addFiles([jpgFile('b.jpg')])
    })
    await waitFor(() => expect(result.current.pictures).toHaveLength(2))
    expect(result.current.loading).toBe(true)

    await act(async () => {
      first.resolve(decoded)
    })
    // The first run finished, but the second is still decoding.
    await waitFor(() => expect(result.current.pictures[0].status).toBe('ready'))
    expect(result.current.loading).toBe(true)
    expect(result.current.pictures[1].status).toBe('loading')

    await act(async () => {
      second.resolve({ ...decoded, previewUrl: 'data:image/jpeg;base64,B' })
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.pictures.every((picture) => picture.status === 'ready')).toBe(true)
  })

  it('names each unsupported file when no supported Pictures arrive', async () => {
    const { result } = renderHook(() => useBatchIngest())
    await act(async () => {
      await result.current.addFiles([
        new File(['x'], 'notes.txt', { type: 'text/plain' }),
        new File(['x'], 'clip.mp4', { type: 'video/mp4' }),
      ])
    })
    expect(result.current.error).toContain('notes.txt')
    expect(result.current.error).toContain('clip.mp4')
  })

  it('names the Picture and keeps the Batch error null when one decode fails', async () => {
    vi.mocked(decodePictureFile).mockRejectedValue(new Error('Could not decode Picture broken.jpg'))
    const { result } = renderHook(() => useBatchIngest())
    await act(async () => {
      await result.current.addFiles([jpgFile('broken.jpg')])
    })
    const broken = result.current.pictures[0]
    expect(broken.status).toBe('error')
    expect(broken.error).toContain('broken.jpg')
    expect(result.current.error).toBeNull()
  })

  it('preserves EXIF segment and metadata on the BatchPicture during ingest', async () => {
    vi.mocked(decodePictureFile).mockImplementation(async (file) => ({
      ...decoded,
      name: file.name,
      exifSegment: new Uint8Array([0x45, 0x78, 0x69, 0x66]),
      exif: {
        make: 'Canon',
        model: 'EOS R5',
        dateTimeOriginal: '2026:10:20 14:30:00',
        exposureTime: '1/250',
        fNumber: 2.8,
        iso: 400,
        focalLength: 50,
      },
    }))
    const { result } = renderHook(() => useBatchIngest())
    await act(async () => {
      await result.current.addFiles([jpgFile('a.jpg')])
    })
    const picture = result.current.pictures[0]
    expect(picture.exifSegment).toEqual(new Uint8Array([0x45, 0x78, 0x69, 0x66]))
    expect(picture.exif?.dateTimeOriginal).toBe('2026:10:20 14:30:00')
  })
})
