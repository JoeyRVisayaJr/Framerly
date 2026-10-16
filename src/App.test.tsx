import { render, screen } from '@testing-library/react'
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
})
