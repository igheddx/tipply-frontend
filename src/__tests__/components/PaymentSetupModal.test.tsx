import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/utils/config', () => ({ getApiBaseUrl: () => 'http://api.test', API_BASE_URL: 'http://api.test' }))
vi.mock('../../utils/config', () => ({ getApiBaseUrl: () => 'http://api.test', API_BASE_URL: 'http://api.test' }))

const stripeMock = vi.hoisted(() => ({
  confirmCardSetup: vi.fn(),
  paymentRequest: vi.fn((_config: unknown) => ({ canMakePayment: async () => null, on: () => {} }))
}))
vi.mock('@stripe/stripe-js', () => ({ loadStripe: async () => ({ ...stripeMock }) }))
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CardElement: () => <div data-testid="card-element" />,
  useStripe: () => ({ ...stripeMock }),
  useElements: () => ({ getElement: () => ({}) })
}))

import PaymentSetupModal from '@/components/PaymentSetupModal'

const open = (over: Partial<React.ComponentProps<typeof PaymentSetupModal>> = {}) =>
  render(
    <PaymentSetupModal isOpen onClose={vi.fn()} onComplete={vi.fn()} deviceUuid="d1" userId="u1" performerStageName="Dave Lovette" {...over} />
  )

const answer = (setup: { ok: boolean; status?: number; text?: string; json?: unknown }) => {
  global.fetch = vi.fn(async (url: string) => {
    if (String(url).includes('publishable-key')) return { ok: true, json: async () => ({ publishableKey: 'pk_test_x' }) } as Response
    return { ok: setup.ok, status: setup.status ?? 200, text: async () => setup.text ?? '', json: async () => setup.json ?? {} } as Response
  }) as unknown as typeof fetch
}

describe('PaymentSetupModal: the first thing a new tipper sees', () => {
  beforeEach(() => {
    answer({ ok: true, json: { clientSecret: 'cs_x' } })
  })

  it('says up front that nothing is charged now and what happens next', async () => {
    open()
    expect(await screen.findByText(/Add a card once\. Saving it doesn't charge it\./)).toBeInTheDocument()
    expect(screen.getByText(/one tap on an amount sends your tip/i)).toBeInTheDocument()
  })

  it('when a tip was tapped, says that exact tip is sent as soon as the card is saved', async () => {
    open({ tipAmount: 5 })
    expect(await screen.findByText("Your $5 tip is sent as soon as it's saved.")).toBeInTheDocument()
    expect(screen.queryByText(/one tap on an amount sends your tip/i)).toBeNull()
  })

  it('the wallet sheet says what saving is for, shows $0 because nothing is charged, and never the old dash wording', async () => {
    stripeMock.paymentRequest.mockClear()
    open({ tipAmount: 5 })
    await screen.findByText(/Add a card once/)
    await waitFor(() => expect(stripeMock.paymentRequest).toHaveBeenCalled())
    const config = stripeMock.paymentRequest.mock.calls[0][0] as { total: { label: string; amount: number } }
    expect(config.total.label).toBe('Save your card to send a $5 tip')
    expect(config.total.amount).toBe(0)
  })

  it('without a held tip, the wallet sheet names the performer', async () => {
    stripeMock.paymentRequest.mockClear()
    open()
    await waitFor(() => expect(stripeMock.paymentRequest).toHaveBeenCalled())
    const config = stripeMock.paymentRequest.mock.calls[0][0] as { total: { label: string } }
    expect(config.total.label).toBe('Save your card to tip Dave Lovette')
  })

  it('uses friendly words: the card option is not called paying, and leaving is "Not now"', async () => {
    open()
    expect(await screen.findByRole('button', { name: 'Use a card' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pay with card/i })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  })

  it('explains why it is safe, in plain words and above the fold of small print', async () => {
    open()
    expect(await screen.findByText('Your card goes straight to Stripe')).toBeInTheDocument()
    expect(screen.getByText(/Tipwave never sees your card number/)).toBeInTheDocument()
  })

  it('falls back to the performer’s initial when the photo cannot load', async () => {
    const { container } = open({ performerPhotoUrl: 'https://example.com/missing.jpg' })
    await screen.findByText(/You're about to light up their stage/)
    const photo = () => container.querySelector('img.rounded-full') as HTMLImageElement | null
    expect(photo()).not.toBeNull()
    fireEvent.error(photo() as HTMLImageElement)
    expect(photo()).toBeNull()
    expect(screen.getByText('D')).toBeInTheDocument()
  })

  it('"Not now" closes it', async () => {
    const onClose = vi.fn()
    open({ onClose })
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('when the server fails, shows a calm message that nothing was charged, never the server text', async () => {
    answer({ ok: false, status: 500, text: 'System.NullReferenceException at Tipply.Api internal stack' })
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Use a card' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save my card' }))
    const alert = await screen.findByText(/Nothing was charged/)
    expect(alert.textContent).not.toMatch(/500|NullReference|Server error|stack/i)
  })

  it('when the network fails, says so calmly and that nothing was charged', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).includes('publishable-key')) return { ok: true, json: async () => ({ publishableKey: 'pk_test_x' }) } as Response
      throw new Error('socket hang up')
    }) as unknown as typeof fetch
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Use a card' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save my card' }))
    const alert = await screen.findByText(/Nothing was charged/)
    expect(alert.textContent).not.toMatch(/socket|hang up|Network error/i)
  })

  it('shows nothing when closed', () => {
    const { container } = open({ isOpen: false })
    expect(container).toBeEmptyDOMElement()
  })
})
