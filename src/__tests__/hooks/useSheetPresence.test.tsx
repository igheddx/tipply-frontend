import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SongPickerSheet } from '@/components/tip/SongPickerSheet'
import { useSheetPresence } from '@/hooks/useSheetPresence'

// A bottom sheet slides in and out with CSS. These tests pin the moments that matter: it is there as soon as it opens, it only starts
// sliding in once the hidden position has been painted, and after closing it stays long enough to slide away and then is gone.
function Probe({ open }: { open: boolean }) {
  const { mounted, shown } = useSheetPresence(open, 330)
  return <div data-testid="probe">{`${mounted ? 'mounted' : 'gone'}:${shown ? 'shown' : 'hidden'}`}</div>
}
const state = () => screen.getByTestId('probe').textContent

describe('useSheetPresence', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is on screen at once when opened, hidden first, and shown two frames later', () => {
    const { rerender } = render(<Probe open={false} />)
    expect(state()).toBe('gone:hidden')

    rerender(<Probe open />)
    expect(state()).toBe('mounted:hidden') // painted in the hidden position first, so the browser has something to slide from
    act(() => { vi.advanceTimersByTime(40) })
    expect(state()).toBe('mounted:shown')
  })

  it('on close starts sliding away at once, and is removed only after the slide has finished', () => {
    const { rerender } = render(<Probe open />)
    act(() => { vi.advanceTimersByTime(40) })
    expect(state()).toBe('mounted:shown')

    rerender(<Probe open={false} />)
    expect(state()).toBe('mounted:hidden') // sliding away
    act(() => { vi.advanceTimersByTime(300) })
    expect(state()).toBe('mounted:hidden') // not gone yet: the slide takes 330 ms
    act(() => { vi.advanceTimersByTime(40) })
    expect(state()).toBe('gone:hidden')
  })

  it('reopening during the slide away keeps it on screen and brings it back', () => {
    const { rerender } = render(<Probe open />)
    act(() => { vi.advanceTimersByTime(40) })
    rerender(<Probe open={false} />)
    act(() => { vi.advanceTimersByTime(100) })
    rerender(<Probe open />)
    act(() => { vi.advanceTimersByTime(400) })
    expect(state()).toBe('mounted:shown')
  })

  it('starts on screen when it is open from the very first render', () => {
    render(<Probe open />)
    expect(state()).toBe('mounted:hidden')
    act(() => { vi.advanceTimersByTime(40) })
    expect(state()).toBe('mounted:shown')
  })
})

describe('the song picker sheet motion', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const props = { deviceUuid: 'dev-1', onClose: () => {}, onPick: () => {} }

  it('slides up with the same timing and curve it always had, and slides back down before it leaves', () => {
    const { rerender } = render(<SongPickerSheet open {...props} />)
    const sheet = screen.getByRole('dialog', { name: 'Pick a song' })
    expect(sheet.style.transform).toBe('translateY(100%)')
    expect(sheet.style.transition).toBe('transform 330ms cubic-bezier(0.25, 0.16, 0.2, 1)')
    expect((sheet.parentElement as HTMLElement).style.transition).toBe('opacity 300ms cubic-bezier(0.25, 0.1, 0.35, 1)')
    expect((sheet.parentElement as HTMLElement).style.opacity).toBe('0')

    act(() => { vi.advanceTimersByTime(40) })
    expect(sheet.style.transform).toBe('translateY(0)')
    expect((sheet.parentElement as HTMLElement).style.opacity).toBe('1')

    rerender(<SongPickerSheet open={false} {...props} />)
    expect(screen.getByRole('dialog', { name: 'Pick a song' }).style.transform).toBe('translateY(100%)')
    act(() => { vi.advanceTimersByTime(400) })
    expect(screen.queryByRole('dialog', { name: 'Pick a song' })).toBeNull()
  })
})
