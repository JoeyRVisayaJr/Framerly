import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * ErrorBoundary: catches render-time errors anywhere below it (for example a
 * canvas render crashing on a corrupt source) and shows an error screen so the
 * app never leaves the user on a blank page. A plain reload recovers the
 * persisted Frame; in-memory Pictures are lost, as they are on any reload.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(_error: Error, info: ErrorInfo): void {
    // Keep the stack available for diagnosis without taking the app down.
    console.error(info.componentStack)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children
    }
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 text-neutral-50">
        <p role="alert" className="max-w-2xl rounded-xl border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm text-red-200">
          Something went wrong while rendering the Framed Pictures. Reload the page to
          start over; your Frame is saved and survives the reload.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          className="mt-6 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-neutral-950"
        >
          Reload Framerly
        </button>
      </main>
    )
  }
}
