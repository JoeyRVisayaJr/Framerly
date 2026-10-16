import { describe, expect, it, vi } from 'vitest'
import { decodePictureFile } from './pictureDecode'

function pictureFile(name: string, type: string): File {
  return new File(['x'], name, { type })
}

describe('decodePictureFile', () => {
  it('decodes a standard picture into an ~800px preview and releases the source', async () => {
    const file = pictureFile('a.jpg', 'image/jpeg')
    const bitmap = { width: 4000, height: 3000, close: vi.fn() }
    const loadBitmap = vi.fn().mockResolvedValue(bitmap)
    const renderThumbnail = vi.fn().mockResolvedValue('data:preview-a')
    const result = await decodePictureFile(file, {
      convertHeic: vi.fn(),
      loadBitmap,
      renderThumbnail,
    })
    expect(result).toMatchObject({ name: 'a.jpg', width: 800, height: 600 })
    expect(result.previewUrl).toBe('data:preview-a')
    expect(loadBitmap).toHaveBeenCalledWith(file)
    expect(renderThumbnail).toHaveBeenCalledWith(bitmap, { width: 800, height: 600 })
    expect(bitmap.close).toHaveBeenCalled()
  })

  it('converts heic in the browser before decoding, with no server call', async () => {
    const file = pictureFile('b.HEIC', '')
    const converted = new File(['y'], 'b.png', { type: 'image/png' })
    const convertHeic = vi.fn().mockResolvedValue(converted)
    const bitmap = { width: 1600, height: 1600, close: vi.fn() }
    const loadBitmap = vi.fn().mockResolvedValue(bitmap)
    const renderThumbnail = vi.fn().mockResolvedValue('data:preview-b')
    const result = await decodePictureFile(file, { convertHeic, loadBitmap, renderThumbnail })
    expect(result.name).toBe('b.HEIC')
    expect(convertHeic).toHaveBeenCalledWith(file)
    expect(loadBitmap).toHaveBeenCalledWith(converted)
  })

  it('reports a readable error when the picture cannot be decoded', async () => {
    const file = pictureFile('broken.jpg', 'image/jpeg')
    const loadBitmap = vi.fn().mockRejectedValue(new Error('no bitmap'))
    await expect(
      decodePictureFile(file, {
        convertHeic: vi.fn(),
        loadBitmap,
        renderThumbnail: vi.fn(),
      }),
    ).rejects.toThrow('Could not read Picture broken.jpg')
  })
})
