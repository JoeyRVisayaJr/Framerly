import type { PictureExportFormat } from './exportFormat'
import type { AdjustmentInput, CropMode } from './framing'
import type { StoredFrame } from './frameStore'
import type { FocalPoint } from './subjectDetection'

/** One full-resolution render request sent to the Batch Export Worker. */
export interface WorkerRenderRequest {
  id: number
  source: Blob
  frame: StoredFrame
  cropMode?: CropMode
  focalPoint?: FocalPoint
  adjustment?: AdjustmentInput
  format: PictureExportFormat
}

/** The Worker's reply: either the encoded Framed Picture or a named failure. */
export type WorkerRenderResponse =
  | { id: number; blob: Blob }
  | { id: number; error: string }
