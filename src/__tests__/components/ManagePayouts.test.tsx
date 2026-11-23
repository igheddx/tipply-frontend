import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ManagePayouts } from '@/components/portal/ManagePayouts'

const api = vi.hoisted(() => ({ dashboardLink: vi.fn() }))
vi.mock('@/services/payoutApi', () => ({ payoutApi: api }))

// A stand-in for the new tab the browser opens
const fakeTab = () => ({ location: { href: '' }, opener: 'the-app', close: vi.fn() })

describe('ManagePayouts', () => {
  const realOpen = window.open
  const realLocation = window.location
  let tab: ReturnType<typeof fakeTab>
  let assign: ReturnType<typeof vi.fn>

  beforeEach(() => {
    api.dashboardLink.mockReset()
    tab = fakeTab()
    window.open = vi.fn(() => tab as unknown as Window)
    assign = vi.fn()
    Object.defineProperty(window, 'location', { value: { ...realLocation, assign }, writable: true, configurable: true })
  })
  afterEach(() => {
    window.open = realOpen
    Object.defineProperty(window, 'location', { value: realLocation, writable: true, configurable: true })
  })

  const tap = () => fireEvent.click(screen.getByRole('button', { name: /Manage payouts/ }))

  it('says what it is for, in plain words', () => {
    render(<ManagePayouts />)
    expect(screen.getByText(/See your balance and choose automatic or manual payouts in your Stripe dashboard/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Manage payouts/ })).toBeInTheDocument()
  })

  it('opens the new tab at once, on the tap, before waiting for the link, so the phone does not block it', () => {
    api.dashboardLink.mockReturnValue(new Promise(() => {})) // still waiting
    render(<ManagePayouts />)

    tap()

    expect(window.open).toHaveBeenCalledTimes(1)
    expect(window.open).toHaveBeenCalledWith('', '_blank')
    expect(tab.opener).toBeNull() // the dashboard page gets no handle back to the app
  })

  it('sends that tab to the link when it arrives, and never shows the link on the page', async () => {
    api.dashboardLink.mockResolvedValue({ data: { url: 'https://connect.stripe.com/express/one-time' } })
    render(<ManagePayouts />)

    tap()

    await waitFor(() => expect(tab.location.href).toBe('https://connect.stripe.com/express/one-time'))
    expect(tab.close).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
    expect(document.body.textContent).not.toContain('connect.stripe.com')
  })

  it('goes there in this tab instead when the browser would not open a new one', async () => {
    window.open = vi.fn(() => null)
    api.dashboardLink.mockResolvedValue({ data: { url: 'https://connect.stripe.com/express/one-time' } })
    render(<ManagePayouts />)

    tap()

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://connect.stripe.com/express/one-time'))
  })

  it('closes the empty tab and says calmly what to do when payouts are not set up yet', async () => {
    api.dashboardLink.mockResolvedValue({ error: 'Finish setting up payouts first, then you can manage them here.', status: 400 })
    render(<ManagePayouts />)

    tap()

    expect(await screen.findByRole('alert')).toHaveTextContent('Finish setting up payouts first, then you can manage them here.')
    expect(tab.close).toHaveBeenCalled()
    expect(tab.location.href).toBe('')
  })

  it('says to try again, in its own words, when the server gives no message', async () => {
    api.dashboardLink.mockResolvedValue({ status: 502 })
    render(<ManagePayouts />)

    tap()

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be opened just now. Please try again in a moment.')
    expect(tab.close).toHaveBeenCalled()
  })

  it('says to try again when the request itself fails, with no raw error text', async () => {
    api.dashboardLink.mockRejectedValue(new Error('socket hang up'))
    render(<ManagePayouts />)

    tap()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Please try again in a moment.')
    expect(alert.textContent).not.toMatch(/socket|hang up/)
  })

  it('ignores a second tap while the first is still working, so only one link is asked for', async () => {
    let resolve: (v: unknown) => void = () => {}
    api.dashboardLink.mockReturnValue(new Promise(r => { resolve = r }))
    render(<ManagePayouts />)

    tap()
    tap()

    expect(api.dashboardLink).toHaveBeenCalledTimes(1)
    expect(window.open).toHaveBeenCalledTimes(1)
    resolve({ data: { url: 'https://connect.stripe.com/express/one-time' } })
    await waitFor(() => expect(tab.location.href).toContain('one-time'))
  })

  it('clears an old message and works again on the next tap', async () => {
    api.dashboardLink.mockResolvedValueOnce({ error: 'Try later', status: 502 }).mockResolvedValue({ data: { url: 'https://connect.stripe.com/express/two' } })
    render(<ManagePayouts />)

    tap()
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    tab = fakeTab()
    window.open = vi.fn(() => tab as unknown as Window)
    tap()

    await waitFor(() => expect(tab.location.href).toBe('https://connect.stripe.com/express/two'))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
