/**
 * Zero-dependency client-side EXIF APP1 extraction and re-injection for
 * JPEG Pictures. HTML5 Canvas encoding strips every EXIF segment, so the
 * original APP1 segment is preserved ephemerally at ingest and re-injected
 * into the exported Framed Picture JPEG. Non-JPEG Pictures (PNG, WebP,
 * HEIC) carry no APP1 segment and pass through untouched.
 */

/** Capture metadata parsed from the EXIF TIFF directory. */
export interface ExifMetadata {
  /** Camera make (IFD0 tag 0x010F). */
  make: string | null
  /** Camera model (IFD0 tag 0x0110). */
  model: string | null
  /** Original capture timestamp, e.g. `2026:10:20 14:30:00` (Exif tag 0x9003). */
  dateTimeOriginal: string | null
  /** Exposure time as a fraction string, e.g. `1/250` (Exif tag 0x829A). */
  exposureTime: string | null
  /** Aperture f-number, e.g. 2.8 (Exif tag 0x829D). */
  fNumber: number | null
  /** ISO speed rating (Exif tag 0x8827). */
  iso: number | null
  /** Focal length in millimeters (Exif tag 0x920A). */
  focalLength: number | null
}

/** Result of scanning a JPEG byte buffer for an EXIF APP1 segment. */
export interface ExifExtraction {
  /** Raw APP1 payload (`Exif\0\0` + TIFF bytes), or null when no EXIF is present. */
  segment: Uint8Array | null
  metadata: ExifMetadata
}

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]
const EMPTY_METADATA: ExifMetadata = {
  make: null,
  model: null,
  dateTimeOriginal: null,
  exposureTime: null,
  fNumber: null,
  iso: null,
  focalLength: null,
}

function isExifPayload(bytes: Uint8Array, start: number, length: number): boolean {
  if (length < EXIF_HEADER.length) return false
  for (let i = 0; i < EXIF_HEADER.length; i += 1) {
    if (bytes[start + i] !== EXIF_HEADER[i]) return false
  }
  return true
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8
}

/** Length-prefixed JPEG markers that carry no payload beyond the length field. */
function isStandaloneMarker(marker: number): boolean {
  return marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01
}

/**
 * Scan a JPEG byte buffer for the first APP1 segment whose payload starts
 * with `Exif\0\0`. Returns the raw segment plus parsed capture metadata.
 * Non-JPEG, empty, and truncated buffers return an empty extraction.
 */
export function extractExif(bytes: Uint8Array): ExifExtraction {
  if (!isJpeg(bytes)) return { segment: null, metadata: { ...EMPTY_METADATA } }
  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break
    const marker = bytes[offset + 1]
    if (marker === 0x00 || marker === 0xff) {
      offset += 1
      continue
    }
    if (marker === 0xd9) break // EOI: scan data reached without a match.
    if (isStandaloneMarker(marker)) {
      offset += 2
      continue
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
    if (length < 2 || offset + 2 + length > bytes.length) break
    const payloadStart = offset + 4
    const payloadLength = length - 2
    if (marker === 0xe1 && isExifPayload(bytes, payloadStart, payloadLength)) {
      const segment = bytes.slice(payloadStart, payloadStart + payloadLength)
      return { segment, metadata: parseExifSegment(segment) }
    }
    offset += 2 + length
  }
  return { segment: null, metadata: { ...EMPTY_METADATA } }
}

function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    try {
      const res = blob.arrayBuffer()
      if (res instanceof Promise) return res
    } catch {
      // Fallback to FileReader
    }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('Could not read Blob'))
    reader.readAsArrayBuffer(blob)
  })
}

/**
 * Read one EXIF field from a Blob without pulling the whole Picture into
 * memory twice: the caller already keeps the original file for rendering,
 * so this only needs the APP1 segment the JPEG header always carries first.
 */
export async function extractExifFromBlob(blob: Blob): Promise<ExifExtraction> {
  const buffer = new Uint8Array(await readBlobAsArrayBuffer(blob))
  return extractExif(buffer)
}

class TiffReader {
  private view: DataView
  private littleEndian: boolean

  constructor(bytes: Uint8Array) {
    const tiffStart = EXIF_HEADER.length
    this.view = new DataView(bytes.buffer, bytes.byteOffset + tiffStart, bytes.length - tiffStart)
    const first = this.view.getUint8(0)
    const second = this.view.getUint8(1)
    this.littleEndian = first === 0x49 && second === 0x49
    if (!this.littleEndian && !(first === 0x4d && second === 0x4d)) {
      throw new Error('Not a TIFF header')
    }
  }

  u16(offset: number): number {
    return this.view.getUint16(offset, this.littleEndian)
  }

  u32(offset: number): number {
    return this.view.getUint32(offset, this.littleEndian)
  }

  ascii(offset: number, count: number): string {
    let end = offset
    while (end < offset + count && end < this.view.byteLength && this.view.getUint8(end) !== 0) {
      end += 1
    }
    let text = ''
    for (let i = offset; i < end; i += 1) {
      text += String.fromCharCode(this.view.getUint8(i))
    }
    return text
  }

  /** An IFD entry as raw tag, type, count, and the position of its 4-byte value field. */
  entry(ifdOffset: number, index: number): { tag: number; type: number; count: number; fieldOffset: number } {
    const offset = ifdOffset + 2 + index * 12
    return {
      tag: this.u16(offset),
      type: this.u16(offset + 2),
      count: this.u32(offset + 4),
      fieldOffset: offset + 8,
    }
  }

  entryCount(ifdOffset: number): number {
    return this.u16(ifdOffset)
  }

  /** Resolve the data offset for a field, inline when it fits in 4 bytes. */
  dataOffset(entry: { type: number; count: number; fieldOffset: number }): number {
    const typeSizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }
    const total = (typeSizes[entry.type] ?? 1) * entry.count
    // Out-of-line values store their offset in the value field; inline
    // values live in the field itself, which starts at `fieldOffset`.
    return total <= 4 ? entry.fieldOffset : this.u32(entry.fieldOffset)
  }

  rational(offset: number): number {
    const numerator = this.u32(offset)
    const denominator = this.u32(offset + 4)
    return denominator === 0 ? Number.NaN : numerator / denominator
  }
}

/**
 * Parse capture metadata from one APP1 segment (`Exif\0\0` + TIFF bytes).
 * Malformed segments return empty metadata instead of throwing.
 */
export function parseExifSegment(segment: Uint8Array): ExifMetadata {
  const metadata: ExifMetadata = { ...EMPTY_METADATA }
  if (!isExifPayload(segment, 0, segment.length)) return metadata
  try {
    const tiff = new TiffReader(segment)
    if (tiff.u16(2) !== 42) return metadata
    const ifd0Offset = tiff.u32(4)
    const ifd0Entries = new Map<number, { type: number; count: number; fieldOffset: number }>()
    for (let i = 0; i < tiff.entryCount(ifd0Offset); i += 1) {
      const entry = tiff.entry(ifd0Offset, i)
      ifd0Entries.set(entry.tag, entry)
    }
    const makeEntry = ifd0Entries.get(0x010f)
    if (makeEntry) {
      metadata.make = tiff.ascii(tiff.dataOffset(makeEntry), makeEntry.count) || null
    }
    const modelEntry = ifd0Entries.get(0x0110)
    if (modelEntry) {
      metadata.model = tiff.ascii(tiff.dataOffset(modelEntry), modelEntry.count) || null
    }
    const exifPointer = ifd0Entries.get(0x8769)
    if (!exifPointer) return metadata
    const exifIfdOffset = tiff.u32(exifPointer.fieldOffset)
    for (let i = 0; i < tiff.entryCount(exifIfdOffset); i += 1) {
      const entry = tiff.entry(exifIfdOffset, i)
      switch (entry.tag) {
        case 0x9003: {
          const value = tiff.ascii(tiff.dataOffset(entry), entry.count)
          metadata.dateTimeOriginal = value || null
          break
        }
        case 0x829a: {
          const offset = tiff.dataOffset(entry)
          const numerator = tiff.u32(offset)
          const denominator = tiff.u32(offset + 4)
          metadata.exposureTime = denominator === 0 ? null : `${numerator}/${denominator}`
          break
        }
        case 0x829d: {
          const value = tiff.rational(tiff.dataOffset(entry))
          metadata.fNumber = Number.isFinite(value) ? value : null
          break
        }
        case 0x8827: {
          const first16 = tiff.u16(entry.fieldOffset)
          const second16 = tiff.u16(entry.fieldOffset + 2)
          metadata.iso = first16 !== 0 ? first16 : (second16 !== 0 ? second16 : null)
          break
        }
        case 0x920a: {
          const value = tiff.rational(tiff.dataOffset(entry))
          metadata.focalLength = Number.isFinite(value) ? value : null
          break
        }
        default:
          break
      }
    }
  } catch {
    return { ...EMPTY_METADATA }
  }
  return metadata
}

/**
 * Re-inject a preserved EXIF APP1 segment into a freshly encoded canvas JPEG
 * immediately after the SOI marker, so picture management tools keep the
 * original capture timestamp. Non-JPEG bytes and missing segments pass
 * through unchanged.
 */
export function injectExif(jpeg: Uint8Array, segment: Uint8Array | null): Uint8Array {
  if (!segment || !isJpeg(jpeg)) return jpeg
  const length = segment.length + 2
  const header = Uint8Array.from([
    0xff, 0xd8, 0xff, 0xe1, (length >> 8) & 0xff, length & 0xff,
  ])
  const result = new Uint8Array(header.length + segment.length + jpeg.length - 2)
  result.set(header, 0)
  result.set(segment, header.length)
  result.set(jpeg.subarray(2), header.length + segment.length)
  return result
}

/**
 * Re-inject a preserved EXIF APP1 segment into a Blob keeping its MIME type.
 * Non-JPEG Blobs pass through unchanged.
 */
export async function injectExifIntoBlob(blob: Blob, segment: Uint8Array | null): Promise<Blob> {
  if (!segment) return blob
  const bytes = new Uint8Array(await readBlobAsArrayBuffer(blob))
  if (!isJpeg(bytes)) return blob
  const injected = injectExif(bytes, segment)
  return new Blob([injected.buffer as ArrayBuffer], { type: blob.type })
}
