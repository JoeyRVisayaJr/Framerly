import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BatchExportProgress } from './BatchExportProgress'

const progress = { processed: 1, total: 3, currentName: 'IMG_0413.jpg' }

describe('BatchExportProgress', () => {
  it('shows the processed count, percentage, and current filename', () => {
    render(<BatchExportProgress progress={progress} phase="rendering" onCancel={() => {}} />)

    expect(screen.getByRole('status')).toHaveTextContent('1 of 3 Pictures')
    expect(screen.getByRole('status')).toHaveTextContent('33%')
    expect(screen.getByRole('status')).toHaveTextContent('IMG_0413.jpg')
    const bar = screen.getByRole('progressbar', { name: /batch export progress/i })
    expect(bar).toHaveAttribute('max', '3')
    expect(bar).toHaveAttribute('value', '1')
  })

  it('switches to an indeterminate Packaging phase after rendering', () => {
    render(<BatchExportProgress progress={progress} phase="packaging" onCancel={() => {}} />)

    expect(screen.getByRole('status')).toHaveTextContent('Packaging…')
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('value')
  })

  it('stops the run when Cancel is pressed', () => {
    const onCancel = vi.fn()
    render(<BatchExportProgress progress={progress} phase="rendering" onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('disables Cancel once the stop has been requested', () => {
    render(
      <BatchExportProgress
        progress={progress}
        phase="rendering"
        cancelRequested
        onCancel={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /cancelling/i })).toBeDisabled()
  })
})
