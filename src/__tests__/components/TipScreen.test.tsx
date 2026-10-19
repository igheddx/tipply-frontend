import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TipScreen, formatMoney, cardLabel, type TipScreenProps } from '@/components/tip/TipScreen'

const base: TipScreenProps = {
  performerName: 'DJ Prototype',
  bio: 'Live loops & love songs',
  amounts: [2, 5, 10, 20, 50, 100],
  ready: true,
  sentAmount: null,
  onTip: () => {},
  canRequestSong: true,
  selectedSong: null,
  onOpenSongPicker: () => {},
  onClearSong: () => {},
  card: { brand: 'visa', last4: '4242' },
  onChangeCard: () => {},
  total: 189
}

describe('TipScreen', () => {
  it('colors the page and the browser bar to match while it is open, then restores them', () => {
    document.head.insertAdjacentHTML('beforeend', '<meta name="theme-color" content="#0E7490">')
    const { unmount } = render(<TipScreen {...base} />)
    expect(document.documentElement.style.background).toContain('#0a2533')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0a2533')
    unmount()
    expect(document.documentElement.style.background).toBe('')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0E7490')
  })

  it('shows the performer, all six amounts, the saved card and the running total', () => {
    render(<TipScreen {...base} />)
    expect(screen.getByRole('heading', { name: 'Tip DJ Prototype' })).toBeInTheDocument()
    expect(screen.getByText('Live loops & love songs')).toBeInTheDocument()
    for (const amount of ['$2', '$5', '$10', '$20', '$50', '$100']) {
      expect(screen.getByRole('button', { name: `Tip ${amount}` })).toBeInTheDocument()
    }
    expect(screen.getByText(/Visa ••4242/)).toBeInTheDocument()
    expect(screen.getByText('$189')).toBeInTheDocument()
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('sends the tapped amount', () => {
    const onTip = vi.fn()
    render(<TipScreen {...base} onTip={onTip} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tip $20' }))
    expect(onTip).toHaveBeenCalledWith(20)
  })

  it('ignores taps until the page is ready', () => {
    const onTip = vi.fn()
    render(<TipScreen {...base} ready={false} onTip={onTip} />)
    const button = screen.getByRole('button', { name: 'Tip $5' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onTip).not.toHaveBeenCalled()
  })

  it('shows "Sent" on the tapped amount only', () => {
    render(<TipScreen {...base} sentAmount={5} />)
    expect(screen.getByRole('button', { name: 'Tip $5' })).toHaveTextContent('Sent')
    expect(screen.getByRole('button', { name: 'Tip $10' })).toHaveTextContent('$10')
  })

  it('hides Request a song when the performer has no songs or requests are off', () => {
    const { rerender } = render(<TipScreen {...base} />)
    expect(screen.getByRole('button', { name: /Request a song/ })).toBeInTheDocument()
    rerender(<TipScreen {...base} canRequestSong={false} />)
    expect(screen.queryByRole('button', { name: /Request a song/ })).toBeNull()
  })

  it('shows the chosen song as a request and tells the tipper to tap an amount', () => {
    const onClearSong = vi.fn()
    const onOpenSongPicker = vi.fn()
    render(
      <TipScreen {...base} selectedSong={{ title: 'Blinding Lights', artist: 'The Weeknd' }} onClearSong={onClearSong} onOpenSongPicker={onOpenSongPicker} />
    )
    expect(screen.queryByRole('button', { name: /Request a song/ })).toBeNull()
    expect(screen.getByText('Your request')).toBeInTheDocument()
    expect(screen.getByText('Blinding Lights')).toBeInTheDocument()
    expect(screen.getByText('The Weeknd')).toBeInTheDocument()
    expect(screen.getByText(/Tap an amount to send your request/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove song request' }))
    expect(onClearSong).toHaveBeenCalled()
    // "Change" on the request opens the picker (the other "Change" is the card)
    fireEvent.click(screen.getAllByText('Change')[0])
    expect(onOpenSongPicker).toHaveBeenCalled()
  })

  it('labels every amount "Send request" only while a song is waiting for an amount', () => {
    const { rerender } = render(<TipScreen {...base} />)
    expect(screen.queryByText('Send request')).toBeNull()
    rerender(<TipScreen {...base} selectedSong={{ title: 'Blinding Lights', artist: 'The Weeknd' }} />)
    expect(screen.getAllByText('Send request')).toHaveLength(6)
  })

  it('confirms the request once it has been sent', () => {
    render(<TipScreen {...base} sentAmount={10} sentSong={{ title: 'Blinding Lights', artist: 'The Weeknd' }} />)
    expect(screen.getAllByText('Request sent').length).toBeGreaterThanOrEqual(2) // the card and the tapped tile
    expect(screen.getByText('Blinding Lights · The Weeknd')).toBeInTheDocument()
    expect(screen.queryByText('Your request')).toBeNull()
  })

  it('lets the tipper change the saved card', () => {
    const onChangeCard = vi.fn()
    render(<TipScreen {...base} onChangeCard={onChangeCard} />)
    fireEvent.click(screen.getByText('Change'))
    expect(onChangeCard).toHaveBeenCalled()
  })

  it('shows initials when there is no photo, and a placeholder while the name loads', () => {
    const { rerender } = render(<TipScreen {...base} performerName="Ada Lovelace" />)
    expect(screen.getByText('AL')).toBeInTheDocument()
    rerender(<TipScreen {...base} performerName="" ready={false} />)
    expect(screen.queryByRole('heading')).toBeNull()
  })
})

describe('formatting', () => {
  it('formats whole and fractional amounts', () => {
    expect(formatMoney(189)).toBe('$189')
    expect(formatMoney(12.5)).toBe('$12.50')
  })

  it('labels the saved card, with and without details', () => {
    expect(cardLabel({ brand: 'mastercard', last4: '1111' })).toBe('Mastercard ••1111')
    expect(cardLabel({ last4: '9999' })).toBe('••9999')
    expect(cardLabel(null)).toBe('Card on file')
    expect(cardLabel({ brand: 'visa' })).toBe('Card on file')
  })
})
