import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isChunkLoadError, reloadOnceForNewVersion } from '../utils/chunkReload'
import logger from '../utils/logger'

interface State {
  failed: boolean
}

/** Catches a screen that crashes, so the person sees a way forward instead of a blank page. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('Screen crashed:', error, info.componentStack)
    // A screen that could not load because a newer version was published: just reload
    if (isChunkLoadError(error)) reloadOnceForNewVersion()
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-xl font-bold text-ink-900">Something went wrong</h1>
          <p className="mt-2 text-ink-500">This page could not load. Reloading usually fixes it.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
