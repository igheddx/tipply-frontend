import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

type FakeRequest = {
  onsuccess?: (e: any) => void
  onerror?: () => void
  onblocked?: () => void
  onupgradeneeded?: (e: any) => void
}

// A controllable IndexedDB: each open() returns a request the test answers (or never answers) by hand.
const makeFakeIndexedDB = () => {
  const requests: FakeRequest[] = []
  const open = vi.fn(() => {
    const req: FakeRequest = {}
    requests.push(req)
    return req
  })
  // What a successful open + read of the stored deviceId looks like
  const answerWith = (req: FakeRequest, storedId: string | null) => {
    const query: any = {}
    const db = {
      objectStoreNames: { contains: () => true },
      transaction: () => ({
        objectStore: () => ({
          get: () => {
            setTimeout(() => {
              query.result = storedId ? { value: storedId } : undefined
              query.onsuccess?.()
            }, 0)
            return query
          },
          put: () => undefined
        }),
        set oncomplete(fn: () => void) { setTimeout(fn, 0) },
        set onerror(_fn: () => void) { /* unused */ }
      })
    }
    req.onsuccess?.({ target: { result: db } })
  }
  return { open, requests, answerWith }
}

// The shared test setup replaces localStorage with no-op mocks, so use a real in-memory one here
const makeMemoryStorage = () => {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear()
  }
}

describe('device ID', () => {
  let idb: ReturnType<typeof makeFakeIndexedDB>

  const load = async () => {
    vi.resetModules()
    return await import('@/utils/deviceId')
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('localStorage', makeMemoryStorage())
    idb = makeFakeIndexedDB()
    vi.stubGlobal('indexedDB', { open: idb.open })
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses the ID already in localStorage without waiting for IndexedDB', async () => {
    localStorage.setItem('unique_device_id', 'saved-id')
    const { initDeviceId, getUniqueDeviceId } = await load()

    await expect(initDeviceId()).resolves.toBe('saved-id')
    expect(getUniqueDeviceId()).toBe('saved-id')
  })

  it('restores the ID IndexedDB kept when localStorage was cleared', async () => {
    const { initDeviceId, getUniqueDeviceId } = await load()

    const pending = initDeviceId()
    idb.answerWith(idb.requests[0], 'old-id')
    await vi.advanceTimersByTimeAsync(10)

    await expect(pending).resolves.toBe('old-id')
    expect(getUniqueDeviceId()).toBe('old-id')
    expect(localStorage.getItem('unique_device_id')).toBe('old-id')
  })

  it('generates an ID when IndexedDB has none', async () => {
    const { initDeviceId, getUniqueDeviceId } = await load()

    const pending = initDeviceId()
    idb.answerWith(idb.requests[0], null)
    await vi.advanceTimersByTimeAsync(10)

    const id = await pending
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(getUniqueDeviceId()).toBe(id)
  })

  it('does not wait forever on an IndexedDB that never answers', async () => {
    const { initDeviceId } = await load()

    const pending = initDeviceId()
    await vi.advanceTimersByTimeAsync(2000)

    await expect(pending).resolves.toEqual(expect.any(String))
  })

  // Regression: a phone with empty localStorage and a slow IndexedDB. The page picked a new ID after the timeout,
  // then IndexedDB answered with the old one and overwrote localStorage. The setup intent was created with the new
  // ID and the card was saved with the old one, so the server rejected every card ("user_id mismatch").
  it('ignores a late IndexedDB answer once the page has chosen its ID', async () => {
    const { initDeviceId, getUniqueDeviceId } = await load()

    const pending = initDeviceId()
    await vi.advanceTimersByTimeAsync(2000)
    const chosen = await pending

    // IndexedDB finally answers, with a different ID
    idb.answerWith(idb.requests[0], 'late-old-id')
    await vi.advanceTimersByTimeAsync(10)

    expect(getUniqueDeviceId()).toBe(chosen)
    expect(localStorage.getItem('unique_device_id')).toBe(chosen)
  })

  it('returns the same ID on every call, even if localStorage is cleared mid-session', async () => {
    localStorage.setItem('unique_device_id', 'saved-id')
    const { initDeviceId, getUniqueDeviceId } = await load()
    await initDeviceId()

    localStorage.clear()

    expect(getUniqueDeviceId()).toBe('saved-id')
    expect(getUniqueDeviceId()).toBe('saved-id')
    expect(localStorage.getItem('unique_device_id')).toBe('saved-id')
  })

  it('keeps an ID that getUniqueDeviceId generated before start-up finished', async () => {
    const { initDeviceId, getUniqueDeviceId } = await load()

    const pending = initDeviceId()
    const early = getUniqueDeviceId() // e.g. something asked for the ID while IndexedDB was still pending
    idb.answerWith(idb.requests[0], 'old-id')
    await vi.advanceTimersByTimeAsync(10)

    await expect(pending).resolves.toBe(early)
    expect(getUniqueDeviceId()).toBe(early)
  })
})
