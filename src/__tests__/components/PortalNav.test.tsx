import { describe, it, expect } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { PortalShell, sectionsOf, type PortalNavItem } from '@/components/portal/PortalShell'
import { ThemeProvider } from '@/theme/ThemeContext'
import { HomeTab, type HomeData } from '@/components/portal/HomeTab'

const items: PortalNavItem[] = [
  { id: 'overview', label: 'Overview', icon: 'home', pin: true },
  { id: 'performers', label: 'Performers', icon: 'users', group: 'People', pin: true },
  { id: 'tips', label: 'Tips', icon: 'coin', group: 'Money', pin: true },
  { id: 'refunds', label: 'Refunds', icon: 'wallet', group: 'Money', pin: true, badge: 3 },
  { id: 'charges', label: 'Charges', icon: 'card', group: 'Money' },
  { id: 'feedback', label: 'Feedback', icon: 'sparkle', group: 'Learn' },
  { id: 'settings', label: 'Settings', icon: 'sliders', group: 'System' }
]

const shell = () =>
  render(
    <ThemeProvider>
      <PortalShell items={items} active="overview" onSelect={() => {}} userName="Ada" onOpenProfile={() => {}} onLogout={() => {}}>
        <p>page</p>
      </PortalShell>
    </ThemeProvider>
  )

describe('sectionsOf', () => {
  it('splits items into runs that share a heading, in order', () => {
    const s = sectionsOf(items)
    expect(s.map(x => [x.label, x.items.map(i => i.id)])).toEqual([
      [undefined, ['overview']],
      ['People', ['performers']],
      ['Money', ['tips', 'refunds', 'charges']],
      ['Learn', ['feedback']],
      ['System', ['settings']]
    ])
  })
})

describe('PortalShell with grouped items', () => {
  it('labels the groups in the sidebar', () => {
    shell()
    const sidebar = document.querySelector('aside') as HTMLElement
    for (const g of ['People', 'Money', 'Learn', 'System']) expect(within(sidebar).getByText(g)).toBeInTheDocument()
  })

  it('puts the pinned items on the phone bar and the rest, grouped, under More', () => {
    shell()
    const bar = document.querySelectorAll('nav[aria-label="Main"]')[1] as HTMLElement
    expect(within(bar).getAllByRole('button').map(b => b.textContent?.replace(/\d+$/, ''))).toEqual(['Overview', 'Performers', 'Tips', 'Refunds', 'More'])
    fireEvent.click(within(bar).getByText('More'))
    const sheet = screen.getByRole('dialog', { name: 'More' })
    expect(within(sheet).getByText('Charges')).toBeInTheDocument()
    expect(within(sheet).getByText('Learn')).toBeInTheDocument()
    expect(within(sheet).getByText('System')).toBeInTheDocument()
    expect(within(sheet).queryByText('Tips')).toBeNull()
  })
})

const data: HomeData = {
  firstName: 'Ada', today: { amount: 0, count: 0 }, month: { amount: 0, count: 0, trendPercent: 0, trendDirection: 'up' },
  pendingTips: 0, failedTips: 12, failedTipsCount: 1, scheduledPayouts: 0, inTransit: 0, available: 0, lifetime: 0, balancesLoading: false,
  devices: { active: 1, paused: 0, offline: 0, total: 1 }, weeks: [], nextSteps: [{ id: 'device', icon: 'qr', title: 'Add your first device', detail: 'd', done: false, actionLabel: 'Go', onAction: () => {} }, { id: 'photo', icon: 'user', title: 'Add a profile photo', detail: 'p', done: true, actionLabel: 'Add', onAction: () => {} }],
  weeksLoading: false
}

describe('Home order', () => {
  it('shows what needs action before the live button, the numbers and the device status', () => {
    render(
      <HomeTab data={data} formatCurrency={n => `$${n}`} onGoToDevices={() => {}} onGoToTips={() => {}} onGoToLive={() => {}}
        requestsSlot={<div>REFUND-REQUESTS</div>} showSlot={<div>SHOW-CARD</div>} />
    )
    const text = document.body.textContent || ''
    const at = (s: string) => text.indexOf(s)
    expect(at('could not be charged')).toBeGreaterThan(-1)
    expect(at('could not be charged')).toBeLessThan(at('REFUND-REQUESTS'))
    expect(at('REFUND-REQUESTS')).toBeLessThan(at('Finish setting up'))
    expect(at('Finish setting up')).toBeLessThan(at('Open Live'))
    expect(at('Open Live')).toBeLessThan(at('SHOW-CARD'))
    expect(at('SHOW-CARD')).toBeLessThan(at('Tips this month'))
    expect(at('Tips this month')).toBeLessThan(at('1 device'))
  })

  it('puts optional setup steps (songs, photo) lower, and lists only what is left', () => {
    const optional = { ...data, nextSteps: [
      { id: 'device', icon: 'qr' as const, title: 'Add your first device', detail: 'd', done: true, actionLabel: 'Go', onAction: () => {} },
      { id: 'songs', icon: 'music' as const, title: 'Add songs to your catalog', detail: 's', done: false, actionLabel: 'Add songs', onAction: () => {} }
    ] }
    render(<HomeTab data={optional} formatCurrency={n => `$${n}`} onGoToDevices={() => {}} onGoToTips={() => {}} onGoToLive={() => {}} />)
    const text = document.body.textContent || ''
    expect(text.indexOf('Open Live')).toBeLessThan(text.indexOf('Finish setting up'))
    expect(text.indexOf('Tips this month')).toBeLessThan(text.indexOf('Finish setting up'))
    expect(text).toContain('1 of 2 left')
    expect(text).not.toContain('Add your first device')
  })
})
