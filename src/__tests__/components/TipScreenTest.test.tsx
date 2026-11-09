import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/utils/appVersion', async () => ({ ...(await vi.importActual<any>('@/utils/appVersion')), APP_VERSION: 'T11.26.062' }))
import { TipScreen, type TipScreenProps } from '@/components/tip/TipScreen'

const base: TipScreenProps = {
  performerName: 'DJ Prototype', bio: '', amounts: [2, 5, 10, 20, 50, 100], ready: true, sentAmount: null, onTip: () => {},
  canRequestSong: false, selectedSong: null, onOpenSongPicker: () => {}, onClearSong: () => {},
  card: { brand: 'visa', last4: '4242' }, onChangeCard: () => {}, total: 0
}

describe('TipScreen on the test site', () => {
  it('is plum, with a plain "Test site" strip, and puts the colors back when closed', () => {
    document.head.insertAdjacentHTML('beforeend', '<meta name="theme-color" content="#0E7490">')
    const { unmount } = render(<TipScreen {...base} />)
    expect(screen.getByText(/Test site/)).toBeInTheDocument()
    expect(document.documentElement.style.backgroundImage).toContain('#26091f')
    expect(document.documentElement.style.backgroundImage).not.toContain('#0a2533')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#26091f')
    unmount()
    expect(document.documentElement.style.backgroundImage).toBe('')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0E7490')
  })
})
