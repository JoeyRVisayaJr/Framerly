import type { Size } from './framing'

/** Longest edge in pixels for lightweight Batch preview thumbnails. */
export const THUMBNAIL_MAX_EDGE = 800

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'])

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.toLowerCase().slice(dot) : ''
}

/** True for Apple HEIC/HEIF pictures needing in-browser conversion. */
export function isHeicFile(file: File): boolean {
  if (file.type === 'image/heic' || file.type === 'image/heif') return true
  const ext = extensionOf(file.name)
  return ext === '.heic' || ext === '.heif'
}

/** Accept JPG, PNG, WebP by MIME with extension fallback, plus HEIC/HEIF. */
export function isSupportedPictureFile(file: File): boolean {
  if (
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    file.type === 'image/webp' ||
    file.type === 'image/heic' ||
    file.type === 'image/heif'
  ) {
    return true
  }
  return SUPPORTED_EXTENSIONS.has(extensionOf(file.name))
}

function sortKey(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  return (relative || file.name).toLowerCase()
}

/** Keep supported pictures and sort stably by directory path then name. */
export function filterPictureFiles(files: File[]): File[] {
  return files.filter(isSupportedPictureFile).sort((a, b) => {
    const ka = sortKey(a)
    const kb = sortKey(b)
    if (ka < kb) return -1
    if (ka > kb) return 1
    return a.name.localeCompare(b.name)
  })
}

/**
 * Scale a picture so its longest edge is `maxEdge` (default ~800px).
 * Small pictures are never upscaled.
 */
export function calculateThumbnailSize(
  source: Size,
  maxEdge: number = THUMBNAIL_MAX_EDGE,
): Size {
  if (
    !Number.isFinite(source.width) ||
    !Number.isFinite(source.height) ||
    source.width <= 0 ||
    source.height <= 0
  ) {
    throw new Error('Picture must have positive width and height')
  }
  const longest = Math.max(source.width, source.height)
  if (longest <= maxEdge) {
    return { width: Math.round(source.width), height: Math.round(source.height) }
  }
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  }
}

interface FileSystemEntryLike {
  isFile: boolean
  isDirectory: boolean
  file?: (
    success: (file: File) => void,
    error?: (err: unknown) => void,
  ) => void
  createReader?: () => {
    readEntries: (
      success: (entries: FileSystemEntryLike[]) => void,
      error?: (err: unknown) => void,
    ) => void
  }
}

interface EntryCapableItem {
  webkitGetAsEntry?: () => FileSystemEntryLike | null
}

function readEntryFile(entry: FileSystemEntryLike): Promise<File | null> {
  return new Promise((resolve) => {
    try {
      entry.file?.(
        (file) => resolve(file),
        () => resolve(null),
      )
    } catch {
      resolve(null)
    }
  })
}

async function readDirectoryEntries(
  reader: { readEntries: (s: (e: FileSystemEntryLike[]) => void, e?: (err: unknown) => void) => void },
): Promise<FileSystemEntryLike[]> {
  const all: FileSystemEntryLike[] = []
  for (;;) {
    const batch: FileSystemEntryLike[] = await new Promise((resolve) => {
      reader.readEntries(
        (entries) => resolve(entries),
        () => resolve([]),
      )
    })
    if (batch.length === 0) return all
    all.push(...batch)
  }
}

async function collectFromEntry(entry: FileSystemEntryLike): Promise<File[]> {
  if (entry.isFile) {
    const file = await readEntryFile(entry)
    return file ? [file] : []
  }
  if (entry.isDirectory && entry.createReader) {
    const children = await readDirectoryEntries(entry.createReader())
    const nested = await Promise.all(children.map(collectFromEntry))
    return nested.flat()
  }
  return []
}

/**
 * Collect picture files from a drop event, traversing dropped directories
 * (including subdirectories) via `webkitGetAsEntry` with a FileList fallback.
 * Entry results and the FileList are merged so mixed drops lose nothing.
 */
export async function collectBatchFiles(dataTransfer: {
  items?: ArrayLike<EntryCapableItem> | DataTransferItemList
  files?: ArrayLike<File> | null
}): Promise<File[]> {
  const entries: FileSystemEntryLike[] = []
  if (dataTransfer.items) {
    const items = Array.from(dataTransfer.items as ArrayLike<EntryCapableItem>)
    for (const item of items) {
      try {
        const entry = item.webkitGetAsEntry?.() ?? null
        if (entry) entries.push(entry)
      } catch {
        // Fall through to the FileList path below.
      }
    }
  }
  const fromEntries =
    entries.length > 0 ? (await Promise.all(entries.map(collectFromEntry))).flat() : []
  const fromFiles = dataTransfer.files ? Array.from(dataTransfer.files as ArrayLike<File>) : []
  const seen = new Set<string>()
  const merged = [...fromEntries, ...fromFiles].filter((file) => {
    const key = `${file.name}-${file.size}-${file.lastModified}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return filterPictureFiles(merged)
}
