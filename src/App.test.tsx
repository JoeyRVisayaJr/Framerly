import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { saveFrame } from './lib/frameStore'

afterEach(() => {
  window.localStorage.clear()
})

describe('App scaffold', () => {
  it('renders the Framerly heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /framerly/i })).toBeInTheDocument()
  })

  it('restores a persisted frame on load', () => {
    saveFrame(window.localStorage, {
      dataUrl: 'data:image/png;base64,AAA',
      width: 1080,
      height: 1920,
      aperture: { x: 120, y: 200, width: 840, height: 1260 },
    })
    render(<App />)
    expect(screen.getByRole('img', { name: /frame preview/i })).toBeInTheDocument()
  })

  it('renders Crop Mode toggle and allows toggling to Fit with Blurred Background', async () => {
    render(<App />)
    const fillButton = screen.getByRole('radio', { name: /crop to fill/i })
    const blurredButton = screen.getByRole('radio', { name: /fit with blurred background/i })
    expect(fillButton).toHaveAttribute('aria-checked', 'true')
    expect(blurredButton).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(blurredButton)
    expect(blurredButton).toHaveAttribute('aria-checked', 'true')
    expect(fillButton).toHaveAttribute('aria-checked', 'false')
  })
})
