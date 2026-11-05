import { describe, expect, it } from 'vitest'
import {
  extractExif,
  extractExifFromBlob,
  injectExif,
  injectExifIntoBlob,
  parseExifSegment,
} from './exif'

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]

function asciiBytes(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0))
}

function writeU16At(bytes: number[], offset: number, value: number, littleEndian: boolean): void {
  if (littleEndian) {
    bytes[offset] = value & 0xff
    bytes[offset + 1] = (value >> 8) & 0xff
  } else {
    bytes[offset] = (value >> 8) & 0xff
    bytes[offset + 1] = value & 0xff
  }
}

function writeU32At(bytes: number[], offset: number, value: number, littleEndian: boolean): void {
  if (littleEndian) {
    bytes[offset] = value & 0xff
    bytes[offset + 1] = (value >> 8) & 0xff
    bytes[offset + 2] = (value >> 16) & 0xff
    bytes[offset + 3] = (value >> 24) & 0xff
  } else {
    bytes[offset] = (value >> 24) & 0xff
    bytes[offset + 1] = (value >> 16) & 0xff
    bytes[offset + 2] = (value >> 8) & 0xff
    bytes[offset + 3] = value & 0xff
  }
}

/**
 * Build a minimal JPEG that carries one APP1 EXIF segment.
 * TIFF bytes are little-endian ("II") for even offsets or big-endian ("MM").
 */
function buildJpegWithExif(options: {
  littleEndian?: boolean
  make?: string
  model?: string
  dateTimeOriginal?: string
  exposureTime?: [number, number]
  fNumber?: [number, number]
  iso?: number
  focalLength?: [number, number]
} = {}): Uint8Array {
  const littleEndian = options.littleEndian ?? true
  const make = options.make ?? 'Canon'
  const model = options.model ?? 'EOS R5'
  const dateTimeOriginal = options.dateTimeOriginal ?? '2026:10:20 14:30:00'
  const exposureTime = options.exposureTime ?? [1, 250]
  const fNumber = options.fNumber ?? [28, 10]
  const iso = options.iso ?? 400
  const focalLength = options.focalLength ?? [50, 1]

  const makeBytes = [...asciiBytes(make), 0x00]
  const modelBytes = [...asciiBytes(model), 0x00]
  const dateTimeBytes = [...asciiBytes(dateTimeOriginal), 0x00]

  // TIFF header is 8 bytes, IFD0 holds 3 entries.
  const ifd0Start = 8
  const ifd0Size = 2 + 3 * 12 + 4
  const makeDataOffset = ifd0Start + ifd0Size
  const modelDataOffset = makeDataOffset + makeBytes.length
  const exifIfdStart = modelDataOffset + modelBytes.length
  const exifIfdSize = 2 + 5 * 12 + 4
  const dateTimeDataOffset = exifIfdStart + exifIfdSize
  const exposureDataOffset = dateTimeDataOffset + dateTimeBytes.length
  const fNumberDataOffset = exposureDataOffset + 8
  const focalLengthDataOffset = fNumberDataOffset + 8
  const tiffSize = focalLengthDataOffset + 8

  const tiff: number[] = new Array(tiffSize).fill(0)
  // Byte order marker and magic.
  if (littleEndian) {
    tiff[0] = 0x49
    tiff[1] = 0x49
  } else {
    tiff[0] = 0x4d
    tiff[1] = 0x4d
  }
  writeU16At(tiff, 2, 42, littleEndian)
  writeU32At(tiff, 4, ifd0Start, littleEndian)

  // IFD0 entries: Make (0x010F), Model (0x0110), ExifIFDPointer (0x8769).
  writeU16At(tiff, ifd0Start, 3, littleEndian)
  function writeIfdEntry(offset: number, tag: number, type: number, count: number, value: number): void {
    writeU16At(tiff, offset, tag, littleEndian)
    writeU16At(tiff, offset + 2, type, littleEndian)
    writeU32At(tiff, offset + 4, count, littleEndian)
    writeU32At(tiff, offset + 8, value, littleEndian)
  }
  writeIfdEntry(ifd0Start + 2, 0x010f, 2, makeBytes.length, makeDataOffset)
  writeIfdEntry(ifd0Start + 14, 0x0110, 2, modelBytes.length, modelDataOffset)
  writeIfdEntry(ifd0Start + 26, 0x8769, 4, 1, exifIfdStart)
  writeU32At(tiff, ifd0Start + 38, 0, littleEndian)

  // Exif IFD entries: DateTimeOriginal, ExposureTime, FNumber, ISO, FocalLength.
  writeU16At(tiff, exifIfdStart, 5, littleEndian)
  writeIfdEntry(exifIfdStart + 2, 0x9003, 2, dateTimeBytes.length, dateTimeDataOffset)
  writeIfdEntry(exifIfdStart + 14, 0x829a, 5, 1, exposureDataOffset)
  writeIfdEntry(exifIfdStart + 26, 0x829d, 5, 1, fNumberDataOffset)
  writeIfdEntry(exifIfdStart + 38, 0x8827, 3, 1, 0)
  writeU16At(tiff, exifIfdStart + 38 + 8, iso, littleEndian)
  writeIfdEntry(exifIfdStart + 50, 0x920a, 5, 1, focalLengthDataOffset)
  writeU32At(tiff, exifIfdStart + 62, 0, littleEndian)

  // Out-of-line data payloads.
  makeBytes.forEach((byte, index) => {
    tiff[makeDataOffset + index] = byte
  })
  modelBytes.forEach((byte, index) => {
    tiff[modelDataOffset + index] = byte
  })
  dateTimeBytes.forEach((byte, index) => {
    tiff[dateTimeDataOffset + index] = byte
  })
  writeU32At(tiff, exposureDataOffset, exposureTime[0], littleEndian)
  writeU32At(tiff, exposureDataOffset + 4, exposureTime[1], littleEndian)
  writeU32At(tiff, fNumberDataOffset, fNumber[0], littleEndian)
  writeU32At(tiff, fNumberDataOffset + 4, fNumber[1], littleEndian)
  writeU32At(tiff, focalLengthDataOffset, focalLength[0], littleEndian)
  writeU32At(tiff, focalLengthDataOffset + 4, focalLength[1], littleEndian)

  const app1Payload = [...EXIF_HEADER, ...tiff]
  const app1Length = app1Payload.length + 2
  const jpeg = [
    0xff, 0xd8, // SOI
    0xff, 0xe1, // APP1
    (app1Length >> 8) & 0xff, app1Length & 0xff,
    ...app1Payload,
    0xff, 0xd9, // EOI
  ]
  return Uint8Array.from(jpeg)
}

/** Minimal canvas-style JPEG: SOI, SOF0, SOS, scan data, EOI. No EXIF. */
function buildCanvasJpeg(): Uint8Array {
  return Uint8Array.from([
    0xff, 0xd8, // SOI
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, // SOF0
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, // SOS
    0x11, 0x22, 0x33, // scan data
    0xff, 0xd9, // EOI
  ])
}

describe('extractExif', () => {
  it('extracts the APP1 segment and capture metadata from a JPEG Picture', () => {
    const extracted = extractExif(buildJpegWithExif())
    expect(extracted.segment).not.toBeNull()
    expect(extracted.segment!.slice(0, 6)).toEqual(Uint8Array.from(EXIF_HEADER))
    expect(extracted.metadata.make).toBe('Canon')
    expect(extracted.metadata.model).toBe('EOS R5')
    expect(extracted.metadata.dateTimeOriginal).toBe('2026:10:20 14:30:00')
  })

  it('extracts exposure parameters for chronological picture management tools', () => {
    const { metadata } = extractExif(buildJpegWithExif())
    expect(metadata.exposureTime).toBe('1/250')
    expect(metadata.fNumber).toBeCloseTo(2.8)
    expect(metadata.iso).toBe(400)
    expect(metadata.focalLength).toBe(50)
  })

  it('reads big-endian TIFF headers', () => {
    const { metadata } = extractExif(buildJpegWithExif({ littleEndian: false }))
    expect(metadata.make).toBe('Canon')
    expect(metadata.dateTimeOriginal).toBe('2026:10:20 14:30:00')
    expect(metadata.iso).toBe(400)
  })

  it('returns an empty segment for a JPEG without EXIF', () => {
    const extracted = extractExif(buildCanvasJpeg())
    expect(extracted.segment).toBeNull()
    expect(extracted.metadata.dateTimeOriginal).toBeNull()
    expect(extracted.metadata.make).toBeNull()
  })

  it('returns an empty segment for non-JPEG content without throwing', () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
    const extracted = extractExif(png)
    expect(extracted.segment).toBeNull()
    expect(extracted.metadata.make).toBeNull()
  })

  it('returns an empty segment for empty and truncated buffers without throwing', () => {
    expect(extractExif(new Uint8Array(0)).segment).toBeNull()
    expect(extractExif(Uint8Array.from([0xff, 0xd8, 0xff])).segment).toBeNull()
    const truncated = buildJpegWithExif().slice(0, 10)
    expect(extractExif(truncated).segment).toBeNull()
  })

  it('skips non-EXIF APP1 payloads and keeps scanning', () => {
    const xmpPayload = [...asciiBytes('http://ns.adobe.com/xap/1.0/')]
    const xmpLength = xmpPayload.length + 2
    const withXmp = Uint8Array.from([
      0xff, 0xd8,
      0xff, 0xe1, (xmpLength >> 8) & 0xff, xmpLength & 0xff, ...xmpPayload,
      ...buildJpegWithExif().slice(2),
    ])
    const extracted = extractExif(withXmp)
    expect(extracted.segment).not.toBeNull()
    expect(extracted.metadata.make).toBe('Canon')
  })
})

describe('parseExifSegment', () => {
  it('parses metadata from a standalone APP1 segment', () => {
    const { segment } = extractExif(buildJpegWithExif())
    const metadata = parseExifSegment(segment!)
    expect(metadata.dateTimeOriginal).toBe('2026:10:20 14:30:00')
    expect(metadata.model).toBe('EOS R5')
  })

  it('returns empty metadata for a malformed segment without throwing', () => {
    const metadata = parseExifSegment(Uint8Array.from([0x45, 0x78, 0x69, 0x66]))
    expect(metadata.dateTimeOriginal).toBeNull()
    expect(metadata.make).toBeNull()
  })
})

describe('injectExif', () => {
  it('re-injects the preserved APP1 segment right after SOI in a canvas JPEG', () => {
    const { segment } = extractExif(buildJpegWithExif())
    const canvas = buildCanvasJpeg()
    const result = injectExif(canvas, segment)
    expect(result.slice(0, 2)).toEqual(Uint8Array.from([0xff, 0xd8]))
    expect(result.slice(2, 4)).toEqual(Uint8Array.from([0xff, 0xe1]))
    const declaredLength = (result[4] << 8) | result[5]
    expect(declaredLength).toBe(segment!.length + 2)
    // The original scan data survives after the inserted segment.
    expect(Array.from(result.slice(result.length - 5))).toEqual([0x11, 0x22, 0x33, 0xff, 0xd9])
  })

  it('round-trips so the injected JPEG still carries the original capture timestamp', () => {
    const { segment } = extractExif(buildJpegWithExif())
    const roundTripped = extractExif(injectExif(buildCanvasJpeg(), segment))
    expect(roundTripped.metadata.dateTimeOriginal).toBe('2026:10:20 14:30:00')
    expect(roundTripped.metadata.make).toBe('Canon')
    expect(roundTripped.metadata.exposureTime).toBe('1/250')
  })

  it('is a no-op without a segment or without JPEG bytes', () => {
    const canvas = buildCanvasJpeg()
    expect(injectExif(canvas, null).slice(2, 4)).toEqual(Uint8Array.from([0xff, 0xc0]))
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47])
    expect(injectExif(png, extractExif(buildJpegWithExif()).segment)).toEqual(png)
  })
})

describe('blob helpers', () => {
  it('extracts EXIF from a Blob', async () => {
    const bytes = buildJpegWithExif()
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'image/jpeg' })
    const extracted = await extractExifFromBlob(blob)
    expect(extracted.metadata.dateTimeOriginal).toBe('2026:10:20 14:30:00')
  })

function toArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

  it('re-injects EXIF into a Blob keeping the JPEG type', async () => {
    const { segment } = extractExif(buildJpegWithExif())
    const canvasBytes = buildCanvasJpeg()
    const canvasBlob = new Blob([canvasBytes.buffer as ArrayBuffer], { type: 'image/jpeg' })
    const result = await injectExifIntoBlob(canvasBlob, segment)
    expect(result.type).toBe('image/jpeg')
    const roundTripped = extractExif(new Uint8Array(await toArrayBuffer(result)))
    expect(roundTripped.metadata.dateTimeOriginal).toBe('2026:10:20 14:30:00')
  })

  it('passes a non-JPEG Blob through re-injection unchanged', async () => {
    const { segment } = extractExif(buildJpegWithExif())
    const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47])
    const pngBlob = new Blob([pngBytes.buffer as ArrayBuffer], { type: 'image/png' })
    const result = await injectExifIntoBlob(pngBlob, segment)
    expect(new Uint8Array(await toArrayBuffer(result))).toEqual(
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
    )
  })
})
