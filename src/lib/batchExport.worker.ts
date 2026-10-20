import { exportEncodeOptions } from './exportFormat'
import { renderFramedPicture } from './framing'
import type { WorkerRenderRequest, WorkerRenderResponse } from './batchExportProtocol'

interface WorkerScope {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<WorkerRenderRequest>) => void,
  ): void
  postMessage(message: WorkerRenderResponse): void
}

const scope = self as unknown as WorkerScope

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not render Picture'
}

/**
 * Batch Export Worker: decode one Picture and Frame, composite the
 * full-resolution Framed Picture on an `OffscreenCanvas` with the shared
 * framing engine, and post back the encoded Blob. One request is handled at a
 * time, matching the sequential render pipeline.
 */
scope.addEventListener('message', (event) => {
  void handleRequest(event.data)
})

async function handleRequest(request: WorkerRenderRequest): Promise<void> {
  try {
    const [picture, frameBlob] = await Promise.all([
      createImageBitmap(request.source),
      fetch(request.frame.dataUrl).then((response) => response.blob()),
    ])
    const frame = await createImageBitmap(frameBlob)
    try {
      const canvas = new OffscreenCanvas(request.frame.width, request.frame.height)
      renderFramedPicture(canvas, {
        picture,
        frame,
        aperture: request.frame.aperture ?? undefined,
        cropMode: request.cropMode,
        focalPoint: request.focalPoint,
        adjustment: request.adjustment,
      })
      const blob = await canvas.convertToBlob(exportEncodeOptions(request.format))
      scope.postMessage({ id: request.id, blob })
    } finally {
      picture.close?.()
      frame.close?.()
    }
  } catch (error) {
    scope.postMessage({ id: request.id, error: errorMessage(error) })
  }
}
