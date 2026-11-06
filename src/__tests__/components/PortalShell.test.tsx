import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { PortalShell, type PortalNavItem } from '@/components/portal/PortalShell'

vi.mock('@/theme/ThemeContext', () => ({
  usePortalTheme: () => ({ dark: false, className: '' }),
  useTheme: () => ({ preference: 'light', resolved: 'light', setPreference: vi.fn(), inPortal: true })
}))

const make = (n: number): PortalNavItem[] =>
  ['Overview', 'Performers', 'Venues', 'Tips', 'Charges', 'Devices', 'Insights', 'Settings'].slice(0, n).map((label, i) => ({ id: label.toLowerCase(), label, icon: 'home', badge: label === 'Settings' ? 3 : undefined }))

const renderShell = (n: number, extra: Partial<React.ComponentProps<typeof PortalShell>> = {}) => {
  const props = { onSelect: vi.fn(), onOpenProfile: vi.fn(), onLogout: vi.fn() }
  render(
    <PortalShell items={make(n)} active="overview" userName="Dom" accountHint="Back to my portal" {...props} {...extra}>
      <p>page</p>
    </PortalShell>
  )
  return props
}

const phoneBar = () => screen.getAllByRole('navigation', { name: 'Main' })[1]

describe('PortalShell on a phone', () => {
  it('shows every item in the bottom bar when there are five or fewer', () => {
    renderShell(5)
    const bar = within(phoneBar())
    expect(bar.getAllByRole('button')).toHaveLength(5)
    expect(bar.queryByRole('button', { name: 'More' })).toBeNull()
  })

  it('keeps four items and a More button when there are many, instead of cramming them all in', () => {
    renderShell(8)
    const bar = within(phoneBar())
    expect(bar.getAllByRole('button').map(b => b.textContent)).toEqual(['Overview', 'Performers', 'Venues', 'Tips', 'More3'])
  })

  it('More opens the rest of the menu, with the account and a way to sign out', () => {
    const props = renderShell(8)
    fireEvent.click(within(phoneBar()).getByRole('button', { name: /More/ }))

    const sheet = screen.getByRole('dialog', { name: 'More' })
    expect(within(sheet).getAllByRole('button').map(b => b.textContent)).toEqual(expect.arrayContaining(['Charges', 'Devices', 'Insights', 'Settings3']))
    fireEvent.click(within(sheet).getByRole('button', { name: 'Devices' }))
    expect(props.onSelect).toHaveBeenCalledWith('devices')
    expect(screen.queryByRole('dialog', { name: 'More' })).toBeNull() // closes after choosing
  })

  it('signs out from the sheet', () => {
    const props = renderShell(8)
    fireEvent.click(within(phoneBar()).getByRole('button', { name: /More/ }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: 'Sign out' }))
    expect(props.onLogout).toHaveBeenCalled()
  })

  it('the avatar opens the account sheet on any portal, so every phone can sign out', () => {
    const props = renderShell(4)
    fireEvent.click(screen.getByRole('button', { name: 'Account and menu' }))
    const sheet = screen.getByRole('dialog', { name: 'More' })
    fireEvent.click(within(sheet).getByRole('button', { name: /Dom/ }))
    expect(props.onOpenProfile).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Account and menu' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: 'Sign out' }))
    expect(props.onLogout).toHaveBeenCalled()
  })

  it('closes on Escape and on the backdrop', () => {
    renderShell(8)
    fireEvent.click(within(phoneBar()).getByRole('button', { name: /More/ }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'More' })).toBeNull()
  })

  it('marks More as the current page when the open page is one of the hidden items', () => {
    renderShell(8, { active: 'settings' })
    expect(within(phoneBar()).getByRole('button', { name: /More/ })).toHaveAttribute('aria-current', 'page')
  })
})
