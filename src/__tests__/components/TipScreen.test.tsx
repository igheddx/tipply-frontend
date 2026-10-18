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

  it('replaces the request button with a chip for the chosen song, which can be removed', () => {
    const onClearSong = vi.fn()
    render(<TipScreen {...base} selectedSong={{ title: 'Blinding Lights', artist: 'The Weeknd' }} onClearSong={onClearSong} />)
    expect(screen.queryByRole('button', { name: /Request a song/ })).toBeNull()
    expect(screen.getByText('Requesting')).toBeInTheDocument()
    expect(screen.getByText('Blinding Lights · The Weeknd')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove song request' }))
    expect(onClearSong).toHaveBeenCalled()
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
