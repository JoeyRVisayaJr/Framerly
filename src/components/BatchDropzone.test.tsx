import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BatchDropzone } from './BatchDropzone'
import { collectBatchFiles } from '../lib/batchIngest'

vi.mock('../lib/batchIngest', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/batchIngest')>()),
  collectBatchFiles: vi.fn(),
}))

describe('BatchDropzone', () => {
  it('shows the batch dropzone with picture and directory pickers', () => {
    render(<BatchDropzone disabled={false} onFiles={() => {}} />)
    expect(screen.getByText(/drop event pictures/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/choose pictures/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/choose a directory/i)).toBeInTheDocument()
  })

  it('forwards chosen files for filtering in the batch hook', () => {
    const onFiles = vi.fn()
    render(<BatchDropzone disabled={false} onFiles={onFiles} />)
    const jpg = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
    const txt = new File(['x'], 'notes.txt', { type: 'text/plain' })
    fireEvent.change(screen.getByLabelText(/choose pictures/i), {
      target: { files: [jpg, txt] },
    })
    expect(onFiles).toHaveBeenCalledTimes(1)
    expect(onFiles.mock.calls[0][0]).toEqual([jpg, txt])
  })

  it('disables input while a batch is loading', () => {
    render(<BatchDropzone disabled onFiles={() => {}} />)
    expect(screen.getByLabelText(/choose pictures/i)).toBeDisabled()
  })

  it('reports a failed directory traversal instead of failing silently', async () => {
    vi.mocked(collectBatchFiles).mockRejectedValue(new Error('access denied'))
    render(<BatchDropzone disabled={false} onFiles={() => {}} />)
    fireEvent.drop(screen.getByText(/drop event pictures/i).closest('div')!, {
      dataTransfer: { files: [] },
    })
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Could not read the dropped directory: access denied'),
    )
  })

  it('clears the traversal error on the next drop', async () => {
    vi.mocked(collectBatchFiles).mockRejectedValue(new Error('access denied'))
    render(<BatchDropzone disabled={false} onFiles={() => {}} />)
    fireEvent.drop(screen.getByText(/drop event pictures/i).closest('div')!, {
      dataTransfer: { files: [] },
    })
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    vi.mocked(collectBatchFiles).mockResolvedValue([])
    fireEvent.drop(screen.getByText(/drop event pictures/i).closest('div')!, {
      dataTransfer: { files: [] },
    })
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})
