import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'
import {
  decodeImageSamples,
  expectSamples,
  FRAME_COLOR,
  makeFramePng,
  makePicturePng,
  type PicturePattern,
} from './support/pictures'

/**
 * Real-browser checks at the bottom seam: the Framed Picture the browser
 * actually renders, and the Batch Export archive the browser actually
 * downloads. Vitest with jsdom cannot run this render path, because its
 * canvas context and image decode are stubs.
 */

// Frame 600 x 400 with an Aperture at (120, 80) sized 360 x 240. Crop to Fill
// scales a 100 x 100 Picture 3.6x to cover the Aperture exactly, so the
// red/blue boundary stays at x = 300 in the Framed Picture.
const FRAME = {
  width: 600,
  height: 400,
  aperture: { x: 120, y: 80, width: 360, height: 240 },
} as const

const PICTURE_SIZE = { width: 100, height: 100 } as const

const SAMPLES = [
  { x: 200, y: 200, expect: [255, 0, 0] }, // Aperture, left of the boundary
  { x: 380, y: 200, expect: [0, 0, 255] }, // Aperture, right of the boundary
  { x: 30, y: 30, expect: FRAME_COLOR }, // outside the Aperture
  { x: 560, y: 370, expect: FRAME_COLOR }, // other Frame corner
] as const


async function uploadFrame(page: Page): Promise<void> {
  const framePng = await makeFramePng(page, FRAME)
  await page.getByLabel('Choose a PNG Frame').setInputFiles({
    name: 'frame.png',
    mimeType: 'image/png',
    buffer: framePng,
  })
  await expect(page.getByText('Frame 600 x 400, Aperture 360 x 240 at 120, 80')).toBeVisible()
}

/**
 * Add every pattern as a Picture in one file-picker call. Both Pictures are
 * named `event-01.jpg` on purpose: the Batch Export must rename the second
 * ZIP entry to `event-01 (2).jpg` instead of merging or overwriting.
 */
async function addPictures(page: Page, patterns: PicturePattern[]): Promise<void> {
  const files = await Promise.all(
    patterns.map(async (pattern) => ({
      name: 'event-01.jpg',
      mimeType: 'image/png',
      buffer: await makePicturePng(page, PICTURE_SIZE, pattern),
    })),
  )
  await page.getByLabel('Choose Pictures').setInputFiles(files)
  await expect(page.getByRole('button', { name: 'Download picture event-01.jpg' }).first()).toBeVisible()
}

type Decoded = Awaited<ReturnType<typeof decodeImageSamples>>

async function decodeDownloaded(
  page: Page,
  bytes: Buffer,
): Promise<Decoded> {
  return decodeImageSamples(page, { base64: bytes.toString('base64'), mimeType: 'image/jpeg' }, [
    ...SAMPLES,
  ])
}

test('Download Picture renders the full-resolution Framed Picture', async ({ page }) => {
  await page.goto('/')
  await uploadFrame(page)
  await addPictures(page, ['red-and-blue', 'solid-green'])

  const downloadButton = page
    .getByRole('button', { name: 'Download picture event-01.jpg' })
    .first()
  const downloadPromise = page.waitForEvent('download')
  await downloadButton.click()
  const download = await downloadPromise
  const path = await download.path()
  expect(path, 'the Framed Picture download must produce a file').toBeTruthy()
  if (!path) throw new Error('Playwright did not provide a download path')
  const bytes = await readFile(path)
  const base64 = bytes.toString('base64')

  await expect(download.suggestedFilename()).toBe('event-01.jpg')
  // High-quality JPEG export by default, per the export format seam.
  expect(bytes[0]).toBe(0xff)
  expect(bytes[1]).toBe(0xd8)

  const decoded = await decodeImageSamples(page, { base64, mimeType: 'image/jpeg' }, [...SAMPLES])
  expect(decoded.width, 'output canvas matches the Frame pixel dimensions').toBe(FRAME.width)
  expect(decoded.height).toBe(FRAME.height)
  expectSamples([...SAMPLES], decoded.samples)
})

test('Batch Export uses the background Worker and keeps Picture names in the ZIP archive', async ({
  page,
}) => {
  const workerUrls: string[] = []
  page.on('worker', (worker) => {
    workerUrls.push(worker.url())
  })

  await page.goto('/')
  await uploadFrame(page)
  await addPictures(page, ['red-and-blue', 'solid-green'])

  // The single download must come from the same rendering seam the Batch
  // Export reuses, so the Framed Picture pixels must match the ZIP entry.
  const singleButton = page
    .getByRole('button', { name: 'Download picture event-01.jpg' })
    .first()
  const singlePromise = page.waitForEvent('download')
  await singleButton.click()
  const singleDownload = await singlePromise
  const singlePath = await singleDownload.path()
  if (!singlePath) throw new Error('Playwright did not provide a download path')
  const singleBytes = await readFile(singlePath)

  await page.getByRole('button', { name: 'Export All as ZIP' }).click()
  await expect(page.getByRole('dialog')).toContainText('Export All as ZIP')
  const archivePromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export ZIP' }).click()
  const archiveDownload = await archivePromise
  const archivePath = await archiveDownload.path()
  if (!archivePath) throw new Error('Playwright did not provide a download path')
  const archiveBytes = await readFile(archivePath)

  // The Worker must actually run: the renderer falls back to the main thread
  // silently, so a correct ZIP alone does not prove the Worker path.
  expect(
    workerUrls.some((url) => url.includes('batchExport.worker')),
    `expected the Batch Export Worker to start, saw ${JSON.stringify(workerUrls)}`,
  ).toBe(true)

  await expect(
    page.getByText(/Exported 2 of 2 Pictures to framerly-\d{4}-\d{2}-\d{2}\.zip\./),
  ).toBeVisible()

  const zip = await JSZip.loadAsync(archiveBytes)
  const entryNames = Object.keys(zip.files)
    .map((name) => zip.files[name])
    .filter((entry) => !entry.dir)
    .map((entry) => entry.name)
  expect(entryNames.sort()).toEqual(['event-01 (2).jpg', 'event-01.jpg'])

  const entryData = zip.files['event-01.jpg']
  const entryBase64 = await entryData?.async('base64')
  expect(entryBase64, 'the archive must contain the Picture').toBeTruthy()
  const entryBytes = Buffer.from(entryBase64 ?? '', 'base64')
  // Both encodings are high-quality JPEG.
  expect(entryBytes[0]).toBe(0xff)
  expect(entryBytes[1]).toBe(0xd8)

  const singleDecoded = await decodeDownloaded(page, singleBytes)
  const entryDecoded = await decodeDownloaded(page, entryBytes)
  expect(entryDecoded.width).toBe(singleDecoded.width)
  expect(entryDecoded.height).toBe(singleDecoded.height)
  expect(entryDecoded.samples).toEqual(singleDecoded.samples)
})
