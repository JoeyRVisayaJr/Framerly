import { describe, expect, it, vi } from 'vitest'
import { renderFramedPictureFile, type PictureExportDeps } from './pictureExport'
import type { StoredFrame } from './frameStore'

const frame: StoredFrame = {
  dataUrl: 'data:image/png;base64,FRAME',
  width: 1080,
  height: 1920,
  aperture: { x: 120, y: 200, width: 840, height: 1260 },
}

function deps() {
  const render = vi.fn()
  const toBlob = vi.fn().mockResolvedValue(new Blob(['out'], { type: 'image/jpeg' }))
  const loadBitmap = vi.fn().mockResolvedValue({ width: 4000, height: 3000, close: vi.fn() })
  const createCanvas = vi.fn((size: { width: number; height: number }) => ({
    width: size.width,
    height: size.height,
  })) as unknown as NonNullable<PictureExportDeps['createCanvas']>
  const loadFrameImage = vi.fn().mockResolvedValue({ width: 1080, height: 1920 })
  const injected: PictureExportDeps = { render, toBlob, loadBitmap, createCanvas, loadFrameImage }
  return { injected, render, toBlob, loadBitmap, createCanvas, loadFrameImage }
}

const pictureFile = new File(['x'], 'IMG_0412.jpg', { type: 'image/jpeg' })

describe('renderFramedPictureFile', () => {
  it('renders at the Frame pixel dimensions with the Picture adjustment applied', async () => {
    const { injected, render, createCanvas } = deps()
    await renderFramedPictureFile(
      {
        file: pictureFile,
        frame,
        cropMode: 'fit-blurred',
        focalPoint: { x: 0.4, y: 0.3 },
        adjustment: { panX: 0.25, panY: 0, zoom: 2, rotation: 90 },
      },
      injected,
    )

    expect(createCanvas).toHaveBeenCalledWith({ width: 1080, height: 1920 })
    const input = render.mock.calls[0][1]
    expect(input.cropMode).toBe('fit-blurred')
    expect(input.focalPoint).toEqual({ x: 0.4, y: 0.3 })
    expect(input.adjustment).toEqual({ panX: 0.25, panY: 0, zoom: 2, rotation: 90 })
    expect(input.aperture).toEqual({ x: 120, y: 200, width: 840, height: 1260 })
  })

  it('encodes a high-quality JPEG named after the original Picture', async () => {
    const { injected, toBlob } = deps()
    const result = await renderFramedPictureFile({ file: pictureFile, frame }, injected)
    expect(toBlob).toHaveBeenCalledWith(expect.anything(), 'image/jpeg', expect.any(Number))
    expect(result.filename).toBe('IMG_0412.jpg')
    expect(result.blob).toBeInstanceOf(Blob)
  })

  it('rejects when encoding fails so the caller can report it', async () => {
    const { injected, toBlob } = deps()
    toBlob.mockRejectedValue(new Error('encode failed'))
    await expect(renderFramedPictureFile({ file: pictureFile, frame }, injected)).rejects.toThrow()
  })

  it('converts a HEIC Picture once and reuses the conversion for another download', async () => {
    const { injected } = deps()
    const convertHeic = vi.fn().mockResolvedValue(new Blob(['jpeg-ish'], { type: 'image/png' }))
    const heic = new File(['x'], 'IMG_0412.heic', { type: 'image/heic' })

    await renderFramedPictureFile({ file: heic, frame }, { ...injected, convertHeic })
    await renderFramedPictureFile({ file: heic, frame }, { ...injected, convertHeic })

    expect(convertHeic).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failed HEIC conversion so the next download can retry', async () => {
    const { injected } = deps()
    const convertHeic = vi
      .fn()
      .mockRejectedValueOnce(new Error('Could not convert Picture IMG_0412.heic'))
      .mockResolvedValueOnce(new Blob(['jpeg-ish'], { type: 'image/png' }))
    const heic = new File(['x'], 'IMG_0412.heic', { type: 'image/heic' })

    await expect(
      renderFramedPictureFile({ file: heic, frame }, { ...injected, convertHeic }),
    ).rejects.toThrow()
    await expect(renderFramedPictureFile({ file: heic, frame }, { ...injected, convertHeic })).resolves.toBeTruthy()
    expect(convertHeic).toHaveBeenCalledTimes(2)
  })

  it('does not cache conversions across different HEIC files', async () => {
    const { injected } = deps()
    const convertHeic = vi.fn().mockResolvedValue(new Blob(['jpeg-ish'], { type: 'image/png' }))

    await renderFramedPictureFile({ file: new File(['x'], 'a.heic', { type: 'image/heic' }), frame }, { ...injected, convertHeic })
    await renderFramedPictureFile({ file: new File(['x'], 'b.heic', { type: 'image/heic' }), frame }, { ...injected, convertHeic })

    expect(convertHeic).toHaveBeenCalledTimes(2)
  })
})
