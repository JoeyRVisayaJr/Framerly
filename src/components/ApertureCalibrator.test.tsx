import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApertureCalibrator } from './ApertureCalibrator'
import type { StoredFrame } from '../lib/frameStore'

describe('ApertureCalibrator', () => {
  const detectedFrame: StoredFrame = {
    dataUrl: 'data:image/png;base64,AAA',
    width: 1000,
    height: 800,
    aperture: { x: 100, y: 100, width: 800, height: 600 },
    detectedAperture: { x: 100, y: 100, width: 800, height: 600 },
    calibrated: false,
  }

  const opaqueFrame: StoredFrame = {
    dataUrl: 'data:image/png;base64,AAA',
    width: 1000,
    height: 800,
    aperture: null,
    detectedAperture: null,
    calibrated: false,
  }

  it('initializes with the detected aperture when available', () => {
    render(
      <ApertureCalibrator
        frame={detectedFrame}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText(/Aperture: 800 x 600 at \(100, 100\)/)).toBeInTheDocument()
  })

  it('initializes with a centered default aperture when frame is opaque', () => {
    render(
      <ApertureCalibrator
        frame={opaqueFrame}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    // 80% of 1000x800 is 800x640 at (100, 80)
    expect(screen.getByText(/Aperture: 800 x 640 at \(100, 80\)/)).toBeInTheDocument()
  })

  it('restores initial aperture when Reset is clicked', () => {
    render(
      <ApertureCalibrator
        frame={detectedFrame}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const resetButton = screen.getByRole('button', { name: 'Reset Aperture' })
    expect(resetButton).toBeInTheDocument()
    fireEvent.click(resetButton)
    expect(screen.getByText(/Aperture: 800 x 600 at \(100, 100\)/)).toBeInTheDocument()
  })

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn()
    render(
      <ApertureCalibrator
        frame={detectedFrame}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm with validated rectangle when Confirm is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ApertureCalibrator
        frame={detectedFrame}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Calibration' }))
    expect(onConfirm).toHaveBeenCalledWith({
      x: 100,
      y: 100,
      width: 800,
      height: 600,
    })
  })

  it('nudges the aperture coordinates with arrow keys', () => {
    render(
      <ApertureCalibrator
        frame={detectedFrame}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const box = screen.getByTestId('calibration-box')
    fireEvent.keyDown(box, { key: 'ArrowRight' })
    expect(screen.getByText(/Aperture: 800 x 600 at \(101, 100\)/)).toBeInTheDocument()
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    expect(screen.getByText(/Aperture: 800 x 600 at \(101, 101\)/)).toBeInTheDocument()
  })
})
