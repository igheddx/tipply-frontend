import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useFeedbackPrompt } from '@/hooks/useFeedbackPrompt'

const api = vi.hoisted(() => ({ prompt: vi.fn(), answer: vi.fn(), dismiss: vi.fn() }))
vi.mock('@/services/feedbackApi', () => ({ feedbackApi: api }))

const stars = { promptId: 'p1', question: 'ease', kind: 'stars', text: 'How easy was that?', options: [], lowScoreMax: 3, reasons: [{ key: 'other', label: 'Something else' }], textPlaceholder: '' }
const song = { ...stars, promptId: 'p2', question: 'song_found', kind: 'choice', text: 'Did you find the song you wanted?', options: [{ key: 'yes', label: 'Yes' }, { key: 'no', label: 'No' }] }

beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset())
  api.answer.mockResolvedValue(true)
  api.dismiss.mockResolvedValue(undefined)
  window.history.replaceState({}, '', '/tip/abc')
})
afterEach(() => vi.useRealTimers())

describe('useFeedbackPrompt', () => {
  it('shows nothing when the server says not to ask', async () => {
    api.prompt.mockResolvedValue(null)
    const { result } = renderHook(() => useFeedbackPrompt('u1', 'dev'))
    await act(async () => { await result.current.onTipConfirmed(false) })
    expect(result.current.phase).toBeNull()
    expect(result.current.prompt).toBeNull()
  })

  it('does not even ask the server before the tipper id is known', async () => {
    const { result } = renderHook(() => useFeedbackPrompt('', undefined))
    await act(async () => { await result.current.onTipConfirmed(false) })
    expect(api.prompt).not.toHaveBeenCalled()
  })

  it('asks the server at most once per visit, however many tips go through', async () => {
    api.prompt.mockResolvedValue(null)
    const { result } = renderHook(() => useFeedbackPrompt('u1', 'dev'))
    await act(async () => { await result.current.onTipConfirmed(false) })
    await act(async () => { await result.current.onTipConfirmed(false) })
    await act(async () => { await result.current.onTipConfirmed(true) })
    expect(api.prompt).toHaveBeenCalledTimes(1)
  })

  it('tells the server whether a song was used, and forces the ask only with ?feedback=now', async () => {
    api.prompt.mockResolvedValue(null)
    window.history.replaceState({}, '', '/tip/abc?feedback=now')
    const { result } = renderHook(() => useFeedbackPrompt('u1', 'dev'))
    await act(async () => { await result.current.onTipConfirmed(true) })
    expect(api.prompt).toHaveBeenCalledWith('u1', 'dev', true, true)
  })

  it('a high rating records the answer and just says thank you, then clears itself', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.prompt.mockResolvedValue(stars)
    const { result } = renderHook(() => useFeedbackPrompt('u1', 'dev'))
    await act(async () => { await result.current.onTipConfirmed(false) })
    expect(result.current.phase).toBe('asking')

    act(() => result.current.rate(5))

    expect(api.answer).toHaveBeenCalledWith('p1', 'u1', { rating: 5 })
    expect(result.current.phase).toBe('thanks')
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.phase).toBeNull()
  })

  it('a low rating opens the follow-up, and sending it records the reason and words', async () => {
    api.prompt.mockResolvedValue(stars)
    const { result } = renderHook(() => useFeedbackPrompt('u1', 'dev'))
    await act(async () => { await result.current.onTipConfirmed(false) })

    act(() => result.current.rate(2))
    expect(result.current.phase).toBe('followup')
    act(() => result.current.sendFollowUp({ choice: 'other', comment: 'Slow' }))

    expect(api.answer).toHaveBeenLastCalledWith('p1', 'u1', { choice: 'other', comment: 'Slow' })
    expect(result.current.phase).toBe('thanks')
  })

  it('skipping the follow-up sends nothing more', async () => {
    api.prompt.mockResolvedValue(stars)
    const { result } = renderHook(() => useFeedbackPrompt('u1', 'dev'))
    await act(async () => { await result.current.onTipConfirmed(false) })
    act(() => result.current.rate(1))
    api.answer.mockClear()

    act(() => result.current.sendFollowUp({}))

    expect(api.answer).not.toHaveBeenCalled()
  })

  it('the song question: Yes just says thanks; anything else asks which song', async () => {
    api.prompt.mockResolvedValue(song)
    const { result } = renderHook(() => useFeedbackPrompt('u1', 'dev'))
    await act(async () => { await result.current.onTipConfirmed(true) })

    act(() => result.current.choose('no'))

    expect(api.answer).toHaveBeenCalledWith('p2', 'u1', { choice: 'no' })
    expect(result.current.phase).toBe('followup')
  })

  it('closing it records a dismissal and removes it at once', async () => {
    api.prompt.mockResolvedValue(stars)
    const { result } = renderHook(() => useFeedbackPrompt('u1', 'dev'))
    await act(async () => { await result.current.onTipConfirmed(false) })

    act(() => result.current.dismissNow())

    expect(api.dismiss).toHaveBeenCalledWith('p1', 'u1')
    expect(result.current.phase).toBeNull()
  })

  it('tapping elsewhere after it was answered does not turn the answer into a dismissal', async () => {
    api.prompt.mockResolvedValue(stars)
    const { result } = renderHook(() => useFeedbackPrompt('u1', 'dev'))
    await act(async () => { await result.current.onTipConfirmed(false) })
    act(() => result.current.rate(5))

    act(() => result.current.dismissNow())

    expect(api.dismiss).not.toHaveBeenCalled()
  })
})
