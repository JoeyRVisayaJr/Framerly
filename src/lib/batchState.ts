import { DEFAULT_ADJUSTMENT, normalizeAdjustment, type Adjustment, type AdjustmentInput } from './framing'
import type { FocalPoint } from './subjectDetection'

export type BatchPictureStatus = 'loading' | 'ready' | 'error'

export interface BatchPicture {
  id: string
  name: string
  width: number
  height: number
  previewUrl: string
  status: BatchPictureStatus
  error?: string
  focalPoint?: FocalPoint
  /** The original Picture file, kept in memory so single-Picture and Batch export can render at full resolution. */
  file?: File
  /** Manual pan/zoom/rotation for this Picture. Seeded to the auto-centered default on ingest. */
  adjustment: Adjustment
}

export interface BatchState {
  pictures: BatchPicture[]
}

/** A Picture as it arrives from ingest, before the reducer seeds its adjustment. */
export type UnseededPicture = Omit<BatchPicture, 'adjustment'> & { adjustment?: Adjustment }

export type BatchAction =
  | { type: 'set'; pictures: UnseededPicture[] }
  | { type: 'adjust'; id: string; adjustment: AdjustmentInput }
  | { type: 'reset'; id: string }
  | { type: 'remove'; id: string }

function withSeededAdjustment(picture: UnseededPicture): BatchPicture {
  return { ...picture, adjustment: picture.adjustment ?? DEFAULT_ADJUSTMENT }
}

function mapPicture(
  state: BatchState,
  id: string,
  fn: (picture: BatchPicture) => BatchPicture,
): BatchState {
  let changed = false
  const pictures = state.pictures.map((picture) => {
    if (picture.id !== id) return picture
    changed = true
    return fn(picture)
  })
  return changed ? { ...state, pictures } : state
}

/**
 * True when a Picture finished reading and still holds its original file, so
 * single-Picture and Batch Export can render it at full resolution.
 */
export function isReadyPicture(
  picture: BatchPicture,
): picture is BatchPicture & { file: File } {
  return picture.status === 'ready' && picture.file !== undefined
}

/**
 * Pure reducer for per-Batch Picture lifecycle: seeding adjustment on ingest,
 * updating one Picture's adjustment, resetting it, and removing it.
 * Unknown ids leave the state unchanged.
 */
export function batchReducer(state: BatchState, action: BatchAction): BatchState {
  switch (action.type) {
    case 'set':
      return { pictures: action.pictures.map(withSeededAdjustment) }
    case 'adjust':
      return mapPicture(state, action.id, (picture) => ({
        ...picture,
        adjustment: normalizeAdjustment({ ...picture.adjustment, ...action.adjustment }),
      }))
    case 'reset':
      return mapPicture(state, action.id, (picture) => ({
        ...picture,
        adjustment: DEFAULT_ADJUSTMENT,
      }))
    case 'remove':
      return { pictures: state.pictures.filter((picture) => picture.id !== action.id) }
    default:
      return state
  }
}
