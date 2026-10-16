import { describe, expect, it } from 'vitest'
import {
  calculateThumbnailSize,
  collectBatchFiles,
  filterPictureFiles,
  isHeicFile,
  isSupportedPictureFile,
} from './batchIngest'

function pictureFile(name: string, type: string): File {
  return new File(['x'], name, { type })
}

describe('isHeicFile', () => {
  it('detects heic and heif by type or extension', () => {
    expect(isHeicFile(pictureFile('a.heic', 'image/heic'))).toBe(true)
    expect(isHeicFile(pictureFile('b.heif', 'image/heif'))).toBe(true)
    expect(isHeicFile(pictureFile('c.HEIC', ''))).toBe(true)
    expect(isHeicFile(pictureFile('d.jpg', 'image/jpeg'))).toBe(false)
  })
})

describe('isSupportedPictureFile', () => {
  it('accepts jpg, png, webp, heic, and heif', () => {
    expect(isSupportedPictureFile(pictureFile('a.jpg', 'image/jpeg'))).toBe(true)
    expect(isSupportedPictureFile(pictureFile('b.jpeg', 'image/jpeg'))).toBe(true)
    expect(isSupportedPictureFile(pictureFile('c.png', 'image/png'))).toBe(true)
    expect(isSupportedPictureFile(pictureFile('d.webp', 'image/webp'))).toBe(true)
    expect(isSupportedPictureFile(pictureFile('e.heic', 'image/heic'))).toBe(true)
    expect(isSupportedPictureFile(pictureFile('f.heif', ''))).toBe(true)
  })

  it('rejects non-picture files', () => {
    expect(isSupportedPictureFile(pictureFile('a.txt', 'text/plain'))).toBe(false)
    expect(isSupportedPictureFile(pictureFile('b.mp4', 'video/mp4'))).toBe(false)
    expect(isSupportedPictureFile(pictureFile('frame.png', 'image/png'))).toBe(true)
  })
})

describe('filterPictureFiles', () => {
  it('keeps only supported pictures and sorts by path then name', () => {
    const files = [
      pictureFile('b.jpg', 'image/jpeg'),
      pictureFile('a.jpg', 'image/jpeg'),
      pictureFile('notes.txt', 'text/plain'),
    ]
    const [first, second, third] = files
    Object.defineProperty(first, 'webkitRelativePath', { value: 'event/b.jpg' })
    Object.defineProperty(second, 'webkitRelativePath', { value: 'event/a.jpg' })
    Object.defineProperty(third, 'webkitRelativePath', { value: 'event/notes.txt' })
    const result = filterPictureFiles(files)
    expect(result.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg'])
  })
})

describe('collectBatchFiles', () => {
  it('merges entry traversal with the file list so mixed drops lose nothing', async () => {
    const fromEntry = pictureFile('entry.jpg', 'image/jpeg')
    const fromList = pictureFile('listed.png', 'image/png')
    const entry = {
      isFile: true,
      isDirectory: false,
      file: (success: (file: File) => void) => success(fromEntry),
    }
    const result = await collectBatchFiles({
      items: [{ webkitGetAsEntry: () => entry }],
      files: [fromEntry, fromList],
    })
    expect(result.map((f) => f.name).sort()).toEqual(['entry.jpg', 'listed.png'])
  })

  it('falls back to the file list when no entries exist', async () => {
    const jpg = pictureFile('a.jpg', 'image/jpeg')
    const txt = pictureFile('notes.txt', 'text/plain')
    const result = await collectBatchFiles({ files: [jpg, txt] })
    expect(result).toEqual([jpg])
  })

  it('keeps same-name pictures from different subdirectories', async () => {
    const first = new File(['x'], 'same.jpg', { type: 'image/jpeg', lastModified: 1000 })
    const second = new File(['x'], 'same.jpg', { type: 'image/jpeg', lastModified: 1000 })
    Object.defineProperty(first, 'webkitRelativePath', { value: 'event/a/same.jpg' })
    Object.defineProperty(second, 'webkitRelativePath', { value: 'event/b/same.jpg' })
    const result = await collectBatchFiles({ files: [first, second] })
    expect(result).toEqual([first, second])
  })

  it('counts a list file duplicating a traversed entry only once', async () => {
    const fromEntry = new File(['x'], 'dup.jpg', { type: 'image/jpeg', lastModified: 2000 })
    const fromList = new File(['x'], 'dup.jpg', { type: 'image/jpeg', lastModified: 2000 })
    Object.defineProperty(fromList, 'webkitRelativePath', { value: 'event/dup.jpg' })
    const entry = {
      isFile: true,
      isDirectory: false,
      file: (success: (file: File) => void) => success(fromEntry),
    }
    const result = await collectBatchFiles({
      items: [{ webkitGetAsEntry: () => entry }],
      files: [fromList],
    })
    expect(result).toEqual([fromEntry])
  })
})

describe('calculateThumbnailSize', () => {
  it('scales the long edge down to 800 without upscaling small pictures', () => {
    // Known-good literals: 4000x3000 -> 800x600; 3000x4000 -> 600x800
    expect(calculateThumbnailSize({ width: 4000, height: 3000 })).toEqual({
      width: 800,
      height: 600,
    })
    expect(calculateThumbnailSize({ width: 3000, height: 4000 })).toEqual({
      width: 600,
      height: 800,
    })
    expect(calculateThumbnailSize({ width: 400, height: 300 })).toEqual({
      width: 400,
      height: 300,
    })
  })

  it('rejects non-positive dimensions', () => {
    expect(() => calculateThumbnailSize({ width: 0, height: 100 })).toThrow()
  })
})
