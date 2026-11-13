import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'
import { cleanup, configure } from '@testing-library/react'

// findBy / waitFor wait up to 1 second by default, which a busy machine running the whole suite can exceed. Waiting longer costs
// nothing when the thing appears at once; it only stops a slow machine from failing a test that is right.
configure({ asyncUtilTimeout: 5000 })

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock fetch globally for tests
globalThis.fetch = vi.fn() as any

// Setup localStorage mock
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
globalThis.localStorage = localStorageMock as any
