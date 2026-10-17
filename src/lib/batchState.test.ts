import { describe, expect, it } from 'vitest'
import {
  batchReducer,
  type BatchPicture,
  type BatchState,
} from './batchState'
import { DEFAULT_ADJUSTMENT } from './framing'

function ready(name: string): Omit<BatchPicture, 'adjustment'> {
  return {
    id: name,
    name,
    width: 800,
    height: 600,
    previewUrl: `data:${name}`,
    status: 'ready',
  }
}

function seeded(): BatchState {
  return batchReducer(
    { pictures: [] },
    { type: 'set', pictures: [ready('a.jpg'), ready('b.jpg')] },
  )
}

describe('batchReducer', () => {
  it('seeds every ingested picture with the default auto-centered adjustment', () => {
    const state = seeded()
    expect(state.pictures[0].adjustment).toEqual(DEFAULT_ADJUSTMENT)
    expect(state.pictures[1].adjustment).toEqual(DEFAULT_ADJUSTMENT)
  })

  it('updates the adjustment of one picture by id and leaves the others alone', () => {
    const state = batchReducer(seeded(), {
      type: 'adjust',
      id: 'a.jpg',
      adjustment: { panX: 0.2, panY: 0, zoom: 2, rotation: 90 },
    })
    expect(state.pictures[0].adjustment).toEqual({ panX: 0.2, panY: 0, zoom: 2, rotation: 90 })
    expect(state.pictures[1].adjustment).toEqual(DEFAULT_ADJUSTMENT)
  })

  it('merges a partial adjustment onto the existing one', () => {
    const zoomed = batchReducer(seeded(), {
      type: 'adjust',
      id: 'a.jpg',
      adjustment: { zoom: 2 },
    })
    const rotated = batchReducer(zoomed, {
      type: 'adjust',
      id: 'a.jpg',
      adjustment: { rotation: 180 },
    })
    expect(rotated.pictures[0].adjustment).toEqual({ panX: 0, panY: 0, zoom: 2, rotation: 180 })
  })

  it('clamps out-of-range zoom and rotation when adjusting', () => {
    const state = batchReducer(seeded(), {
      type: 'adjust',
      id: 'a.jpg',
      adjustment: { zoom: 99, rotation: 400 },
    })
    expect(state.pictures[0].adjustment?.zoom).toBe(3)
    expect(state.pictures[0].adjustment?.rotation).toBe(0)
  })

  it('resets one picture back to the auto-centered default', () => {
    const zoomed = batchReducer(seeded(), {
      type: 'adjust',
      id: 'b.jpg',
      adjustment: { panX: 0.4, panY: 0.1, zoom: 2.5, rotation: 180 },
    })
    const state = batchReducer(zoomed, { type: 'reset', id: 'b.jpg' })
    expect(state.pictures[1].adjustment).toEqual(DEFAULT_ADJUSTMENT)
  })

  it('removes a picture from the batch', () => {
    const state = batchReducer(seeded(), { type: 'remove', id: 'a.jpg' })
    expect(state.pictures.map((p) => p.id)).toEqual(['b.jpg'])
  })

  it('ignores actions for unknown ids', () => {
    const adjusted = batchReducer(seeded(), {
      type: 'adjust',
      id: 'nope',
      adjustment: { zoom: 3 },
    })
    const removed = batchReducer(adjusted, { type: 'remove', id: 'nope' })
    expect(removed.pictures).toHaveLength(2)
  })
})
