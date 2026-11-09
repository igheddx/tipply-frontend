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
  it('says which venue the performer is playing at, on a venue\'s device', () => {
    render(<TipScreen {...base} venueName="The Flying J" />)
    expect(screen.getByText('Performing at The Flying J')).toBeInTheDocument()
  })

  it('shows no venue line on a performer\'s own device', () => {
    render(<TipScreen {...base} />)
    expect(screen.queryByText(/Performing at/)).toBeNull()
  })

  it('colors the page and the browser bar to match while it is open, then restores them', () => {
    document.head.insertAdjacentHTML('beforeend', '<meta name="theme-color" content="#0E7490">')
    const { unmount } = render(<TipScreen {...base} />)
    expect(document.documentElement.style.backgroundImage).toContain('#0a2533')
    expect(document.documentElement.style.backgroundColor).not.toBe('')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0a2533')
    unmount()
    expect(document.documentElement.style.backgroundImage).toBe('')
    expect(document.documentElement.style.backgroundColor).toBe('')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0E7490')
  })

  it('keeps white text readable on every amount tile (3:1 or better at both ends of its gradient)', () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const contrast = (fg: string, bg: string) => {
      const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a)
      return (hi + 0.05) / (lo + 0.05)
    }
    render(<TipScreen {...base} />)
    const tile = screen.getByRole('button', { name: 'Tip $2' })
    const stops = (tile.getAttribute('style') ?? '').match(/#[0-9a-fA-F]{6}/g) ?? []
    expect(stops.length).toBeGreaterThanOrEqual(2)
    for (const stop of stops.filter(c => c.toLowerCase() !== '#ffffff')) expect(contrast('#ffffff', stop)).toBeGreaterThanOrEqual(3)
  })

  it('before a card is saved, the bar invites them to add one instead of showing a card', () => {
    const onChangeCard = vi.fn()
    render(<TipScreen {...base} hasCard={false} card={null} onChangeCard={onChangeCard} total={0} />)
    expect(screen.getByText(/No card yet/)).toBeInTheDocument()
    expect(screen.queryByText(/Card on file/)).toBeNull()
    fireEvent.click(screen.getByText('Add one'))
    expect(onChangeCard).toHaveBeenCalledTimes(1)
  })

  it('shows no total until something has been tipped today', () => {
    render(<TipScreen {...base} total={0} />)
    expect(screen.queryByText('Tipped today')).toBeNull()
    expect(screen.queryByText('$0.00')).toBeNull()
  })

  it('falls back to the initials when the performer photo cannot load', () => {
    const { container } = render(<TipScreen {...base} photoUrl="https://example.com/missing.jpg" />)
    const img = container.querySelector('header img') as HTMLImageElement
    expect(img).not.toBeNull()
    fireEvent.error(img)
    expect(container.querySelector('header img')).toBeNull()
    expect(screen.getByText('DP')).toBeInTheDocument() // DJ Prototype
  })

  it('shows no test strip on production colors', () => {
    render(<TipScreen {...base} />)
    expect(screen.queryByText(/Test site/)).toBeNull()
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
    expect(screen.getByText('Tipped today')).toBeInTheDocument()
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

  it('swaps a quick question into the bottom bar without removing the amounts, and puts the card and total back after', () => {
    const { rerender } = render(<TipScreen {...base} />)
    expect(screen.getByText(/Visa/i)).toBeInTheDocument()

    rerender(<TipScreen {...base} bottomBarOverride={<span>How easy was that?</span>} />)
    expect(screen.getByText('How easy was that?')).toBeInTheDocument()
    expect(screen.queryByText(/Change/)).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Tip \$/ })).toHaveLength(6)

    rerender(<TipScreen {...base} />)
    expect(screen.getByText(/Change/)).toBeInTheDocument()
  })

  it('tints the bottom bar while a question shows, and puts the usual look back after', () => {
    const { container, rerender } = render(<TipScreen {...base} />)
    const bar = () => container.querySelector('div[style*="max(2.5rem, 5.2dvh)"]') as HTMLElement
    expect(bar().style.background).toContain('rgba(8, 12, 40')

    rerender(<TipScreen {...base} bottomBarOverride={<span>Question</span>} />)
    expect(bar().style.background).toContain('rgba(6, 182, 200')

    rerender(<TipScreen {...base} />)
    expect(bar().style.background).toContain('rgba(8, 12, 40')
  })

  it('paints a dark backdrop past the screen edges, so no light strip can show under the phone toolbar', () => {
    const { container } = render(<TipScreen {...base} />)
    const backdrop = container.querySelector('div[aria-hidden="true"][style*="-80px"]') as HTMLElement
    expect(backdrop).not.toBeNull()
    expect(backdrop.style.background).toContain('13, 66, 84')
  })

  it('shows a quiet footer link when one is given', () => {
    render(<TipScreen {...base} footerLink={<button>Give feedback</button>} />)
    expect(screen.getByRole('button', { name: 'Give feedback' })).toBeInTheDocument()
  })
})
