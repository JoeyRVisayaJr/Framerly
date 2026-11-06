import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Tooltip } from './Tooltip'

describe('Tooltip', () => {
  it('renders a button with the given accessible label and hidden content initially', () => {
    render(<Tooltip label="Crop Mode help" content="Crop mode explanation" />)
    const button = screen.getByRole('button', { name: 'Crop Mode help' })
    expect(button).toBeInTheDocument()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('reveals tooltip on mouse enter and hides on mouse leave', () => {
    render(<Tooltip label="Aperture help" content="Aperture coordinates info" />)
    const button = screen.getByRole('button', { name: 'Aperture help' })

    fireEvent.mouseEnter(button)
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toBeInTheDocument()
    expect(tooltip).toHaveTextContent('Aperture coordinates info')

    fireEvent.mouseLeave(button)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('reveals tooltip on focus and hides on blur', () => {
    render(<Tooltip label="Subject Detection help" content="Face detection info" />)
    const button = screen.getByRole('button', { name: 'Subject Detection help' })

    fireEvent.focus(button)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Face detection info')

    fireEvent.blur(button)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
