import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FramePresetPicker } from './FramePresetPicker'
import type { FramePreset } from '../lib/storage'

const sampleBlob = new Blob([new Uint8Array(10)], { type: 'image/png' })

const presets: FramePreset[] = [
  {
    id: 'preset-1',
    name: 'Gala 2026 - Story 9:16',
    width: 1080,
    height: 1920,
    aperture: { x: 120, y: 200, width: 840, height: 1260 },
    calibrated: false,
    createdAt: 1000,
    blob: sampleBlob,
    dataUrl: 'data:image/png;base64,AAA',
  },
  {
    id: 'preset-2',
    name: 'Square 1:1',
    width: 1080,
    height: 1080,
    aperture: { x: 100, y: 100, width: 880, height: 880 },
    calibrated: true,
    createdAt: 2000,
    blob: sampleBlob,
    dataUrl: 'data:image/png;base64,BBB',
  },
]

describe('FramePresetPicker', () => {
  it('renders all saved Frame Presets and the Add Frame action', () => {
    render(
      <FramePresetPicker
        presets={presets}
        activePresetId="preset-1"
        onSelectPreset={() => {}}
        onAddFrame={() => {}}
        onRenamePreset={() => {}}
        onDeletePreset={() => {}}
      />,
    )

    expect(screen.getByText('Gala 2026 - Story 9:16')).toBeInTheDocument()
    expect(screen.getByText('Square 1:1')).toBeInTheDocument()
    expect(screen.getByLabelText(/add frame/i)).toBeInTheDocument()
  })

  it('marks the active preset as selected', () => {
    render(
      <FramePresetPicker
        presets={presets}
        activePresetId="preset-1"
        onSelectPreset={() => {}}
        onAddFrame={() => {}}
        onRenamePreset={() => {}}
        onDeletePreset={() => {}}
      />,
    )

    const activeBtn = screen.getByRole('button', { name: /select gala 2026 - story 9:16/i })
    expect(activeBtn).toHaveAttribute('aria-pressed', 'true')

    const inactiveBtn = screen.getByRole('button', { name: /select square 1:1/i })
    expect(inactiveBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onSelectPreset when an inactive preset is clicked', () => {
    const onSelectPreset = vi.fn()
    render(
      <FramePresetPicker
        presets={presets}
        activePresetId="preset-1"
        onSelectPreset={onSelectPreset}
        onAddFrame={() => {}}
        onRenamePreset={() => {}}
        onDeletePreset={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /select square 1:1/i }))
    expect(onSelectPreset).toHaveBeenCalledWith('preset-2')
  })

  it('provides a naming workflow when adding a new Frame', () => {
    const onAddFrame = vi.fn()
    render(
      <FramePresetPicker
        presets={presets}
        activePresetId="preset-1"
        onSelectPreset={() => {}}
        onAddFrame={onAddFrame}
        onRenamePreset={() => {}}
        onDeletePreset={() => {}}
      />,
    )

    const file = new File(['png-data'], 'event-banner.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText(/add frame/i), { target: { files: [file] } })

    // Naming input appears
    const nameInput = screen.getByLabelText(/preset name/i)
    expect(nameInput).toBeInTheDocument()

    // Type optional descriptive name
    fireEvent.change(nameInput, { target: { value: 'Gala 2026 - Landscape 16:9' } })
    fireEvent.click(screen.getByRole('button', { name: /save preset/i }))

    expect(onAddFrame).toHaveBeenCalledWith(file, 'Gala 2026 - Landscape 16:9')
  })

  it('allows saving newly uploaded Frame with default name if left empty', () => {
    const onAddFrame = vi.fn()
    render(
      <FramePresetPicker
        presets={presets}
        activePresetId="preset-1"
        onSelectPreset={() => {}}
        onAddFrame={onAddFrame}
        onRenamePreset={() => {}}
        onDeletePreset={() => {}}
      />,
    )

    const file = new File(['png-data'], 'custom.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText(/add frame/i), { target: { files: [file] } })

    fireEvent.click(screen.getByRole('button', { name: /save preset/i }))
    expect(onAddFrame).toHaveBeenCalledWith(file, undefined)
  })

  it('renames an existing preset with confirmation', () => {
    const onRenamePreset = vi.fn()
    render(
      <FramePresetPicker
        presets={presets}
        activePresetId="preset-1"
        onSelectPreset={() => {}}
        onAddFrame={() => {}}
        onRenamePreset={onRenamePreset}
        onDeletePreset={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /rename gala 2026 - story 9:16/i }))
    const input = screen.getByLabelText(/rename preset/i)
    fireEvent.change(input, { target: { value: 'Gala 2026 - Final Story' } })
    fireEvent.click(screen.getByRole('button', { name: /save rename/i }))

    expect(onRenamePreset).toHaveBeenCalledWith('preset-1', 'Gala 2026 - Final Story')
  })

  it('cancels renaming without saving', () => {
    const onRenamePreset = vi.fn()
    render(
      <FramePresetPicker
        presets={presets}
        activePresetId="preset-1"
        onSelectPreset={() => {}}
        onAddFrame={() => {}}
        onRenamePreset={onRenamePreset}
        onDeletePreset={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /rename gala 2026 - story 9:16/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel rename/i }))

    expect(onRenamePreset).not.toHaveBeenCalled()
    expect(screen.queryByLabelText(/rename preset/i)).not.toBeInTheDocument()
  })

  it('deletes a preset after inline confirmation', () => {
    const onDeletePreset = vi.fn()
    render(
      <FramePresetPicker
        presets={presets}
        activePresetId="preset-1"
        onSelectPreset={() => {}}
        onAddFrame={() => {}}
        onRenamePreset={() => {}}
        onDeletePreset={onDeletePreset}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /delete gala 2026 - story 9:16/i }))
    expect(onDeletePreset).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /confirm delete gala 2026 - story 9:16/i }))
    expect(onDeletePreset).toHaveBeenCalledWith('preset-1')
  })
})
