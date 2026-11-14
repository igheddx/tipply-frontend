import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useShowList } from '@/hooks/useShowList'

const shows = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/services/showApi', () => ({ showApi: shows }))

const make = (from: number, count: number) => Array.from({ length: count }, (_, i) => ({ id: `s${from + i}`, startedAt: new Date(2026, 10, 30 - (from + i)).toISOString(), isLive: false }))

// 45 shows in all, served 20 at a time, newest first
const serve = (total: number) =>
  shows.list.mockImplementation(async (page: number, size: number) => {
    const start = (page - 1) * size
    return { data: { shows: make(start, Math.max(0, Math.min(size, total - start))), total, page, pageSize: size } }
  })

beforeEach(() => shows.list.mockReset())

describe('useShowList', () => {
  it('shows the first page at once and says there are more', async () => {
    serve(45)
    const { result } = renderHook(() => useShowList(true))

    await waitFor(() => expect(result.current.shows).toHaveLength(20))
    expect(result.current.hasMore).toBe(true)
  })

  it('reaches every show, the last one included, by loading older shows', async () => {
    serve(45)
    const { result } = renderHook(() => useShowList(true))
    await waitFor(() => expect(result.current.shows).toHaveLength(20))

    await act(async () => { await result.current.loadMore() })
    expect(result.current.shows).toHaveLength(40)
    expect(result.current.hasMore).toBe(true)

    await act(async () => { await result.current.loadMore() })
    expect(result.current.shows).toHaveLength(45)
    expect(result.current.shows.at(-1)?.id).toBe('s44') // the oldest show is there, not cut at a page
    expect(result.current.hasMore).toBe(false)
  })

  it('never lists the same show twice when a new show starts between pages', async () => {
    serve(45)
    const { result } = renderHook(() => useShowList(true))
    await waitFor(() => expect(result.current.shows).toHaveLength(20))

    // a new show started: page 2 now begins with a show that was already on page 1
    shows.list.mockImplementation(async (page: number, size: number) => ({ data: { shows: make(page === 2 ? 19 : 0, size), total: 46, page, pageSize: size } }))
    await act(async () => { await result.current.loadMore() })

    const ids = result.current.shows.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has nothing more when every show fits on the first page', async () => {
    serve(3)
    const { result } = renderHook(() => useShowList(true))

    await waitFor(() => expect(result.current.shows).toHaveLength(3))
    expect(result.current.hasMore).toBe(false)
  })

  it('does not load anything while inactive', () => {
    serve(5)
    renderHook(() => useShowList(false))
    expect(shows.list).not.toHaveBeenCalled()
  })

  it('treats a missing total as "everything is here"', async () => {
    shows.list.mockResolvedValue({ data: { shows: make(0, 4) } })
    const { result } = renderHook(() => useShowList(true))

    await waitFor(() => expect(result.current.shows).toHaveLength(4))
    expect(result.current.hasMore).toBe(false)
  })
})
