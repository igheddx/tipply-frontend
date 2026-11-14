import { useCallback, useEffect, useRef, useState } from 'react'
import { showApi, type ShowSummary } from '../services/showApi'

const PAGE = 20

/**
 * A performer's shows, newest first, loaded a page at a time. The first page appears at once and "older shows" loads the next one, so a
 * performer with many shows can reach every one of them (a picker that lists only the newest 10 hides the rest).
 */
export function useShowList(active: boolean) {
  const [shows, setShows] = useState<ShowSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const pageRef = useRef(1)
  const generation = useRef(0)

  useEffect(() => {
    if (!active) return
    const mine = ++generation.current
    pageRef.current = 1
    setShows([])
    setTotal(0)
    void showApi.list(1, PAGE).then(res => {
      if (mine !== generation.current || !Array.isArray(res.data?.shows)) return
      setShows(res.data.shows)
      setTotal(typeof res.data.total === 'number' ? res.data.total : res.data.shows.length)
    })
  }, [active])

  const loadMore = useCallback(async () => {
    const mine = generation.current
    setLoadingMore(true)
    const next = pageRef.current + 1
    const res = await showApi.list(next, PAGE)
    setLoadingMore(false)
    if (mine !== generation.current || !Array.isArray(res.data?.shows)) return
    pageRef.current = next
    // A show that started meanwhile shifts the pages; never list the same show twice
    setShows(prev => [...prev, ...res.data.shows.filter((s: ShowSummary) => !prev.some(p => p.id === s.id))])
    if (typeof res.data.total === 'number') setTotal(res.data.total)
  }, [])

  return { shows, hasMore: shows.length < total, loadMore, loadingMore }
}
