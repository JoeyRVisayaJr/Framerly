import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, type MockInstance } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'
import type { ReactElement } from 'react'

function Crash(): ReactElement {
  throw new Error('canvas exploded')
}

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('all good')).toBeInTheDocument()
  })

  it('shows an error screen with a reload action instead of a blank page', () => {
    const consoleError: MockInstance = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Crash />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i)
    expect(screen.getByRole('button', { name: /reload framerly/i })).toBeInTheDocument()
    consoleError.mockRestore()
  })
})
