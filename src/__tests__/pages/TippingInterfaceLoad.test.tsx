import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { takeTipPreload } from '@/utils/tipPreload'

// What the tip page asks for when it opens (it must open fast after a QR scan): nothing it does not need, and Stripe only when a card is needed.
vi.mock('@/utils/deviceId', async () => {
  const actual: any = await vi.importActual('@/utils/deviceId')
  return { ...actual, initDeviceId: async () => 'visitor-1' }
})
vi.mock('@stripe/stripe-js', () => ({ loadStripe: async () => null }))
vi.mock('@stripe/stripe-js/pure', () => ({ loadStripe: async () => null }))
vi.mock('@stripe/react-stripe-js', () => ({ Elements: ({ children }: any) => <div>{children}</div>, useStripe: () => null, useElements: () => null, CardElement: () => null }))

const mounts: boolean[] = []
vi.mock('@/components/PaymentSetupModal', () => ({
  default: ({ isOpen }: any) => {
    mounts.push(!!isOpen)
    return isOpen ? <div role="dialog" aria-label="card sheet" /> : null
  }
}))

import TippingInterface from '@/pages/TippingInterface'

const device = { id: 'd1', uuid: 'dev-1', ownerFirstName: 'Dave', ownerLastName: 'L', stageName: 'Dave', isStripeVerified: true, isKycVerified: true, tipAmounts: [2, 5, 10, 20, 50, 100], isAllowSongRequest: false, songCount: 0 }
let urls: string[] = []

beforeEach(() => {
  mounts.length = 0
  urls = []
  HTMLCanvasElement.prototype.getContext = vi.fn(() => new Proxy({}, { get: () => () => {}, set: () => true })) as any
  HTMLMediaElement.prototype.play = vi.fn(async () => {}) as any
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url)
    urls.push(u)
    const body = u.includes('/public') ? device
      : u.includes('check-payment-methods') ? { hasPaymentMethods: false }
      : u.includes('user-total') ? { totalAmount: 0 } : u.includes('refund-notices') ? { notices: [], totalAmount: 0 } : {}
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), headers: new Headers() } as any
  }))
  Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }), configurable: true })
  localStorage.clear()
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
  Object.defineProperty(window.navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', configurable: true })
})

const open = () =>
  render(
    <MemoryRouter initialEntries={['/tip/dev-1']}>
      <Routes>
        <Route path="/tip/:deviceId" element={<TippingInterface />} />
      </Routes>
    </MemoryRouter>
  )

describe('the tip page on opening', () => {
  it('does not ask for the AWS IoT status, which a tipper cannot use', async () => {
    open()
    await screen.findByRole('button', { name: 'Tip $2' })
    await waitFor(() => expect(urls.some(u => u.includes('check-payment-methods'))).toBe(true))

    expect(urls.filter(u => u.includes('aws-iot-status'))).toEqual([])
  })

  it('does not load the card sheet (and so not Stripe) until a tipper needs it', async () => {
    open()
    await screen.findByRole('button', { name: 'Tip $2' })
    await waitFor(() => expect(urls.some(u => u.includes('check-payment-methods'))).toBe(true))
    expect(mounts).toEqual([]) // never mounted while the page just sits there

    fireEvent.click(await screen.findByRole('button', { name: 'Tip $5' })) // no saved card: the sheet opens
    expect(await screen.findByRole('dialog', { name: 'card sheet' })).toBeInTheDocument()
  })
})

describe('the tip page does not wait for the saved-card check to show who is being tipped', () => {
  it('shows the performer and the amounts at once, keeps the amounts unavailable until the card check ends, and then enables them', async () => {
    let finishCheck: () => void = () => {}
    const checkDone = new Promise<void>(resolve => { finishCheck = resolve })
    const answer = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), headers: new Headers() }) as any
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url)
      urls.push(u)
      if (u.includes('check-payment-methods')) {
        await checkDone // the slow second request
        return answer({ hasPaymentMethods: true, cardBrand: 'visa', cardLast4: '4242' })
      }
      return answer(u.includes('/public') ? device : u.includes('user-total') ? { totalAmount: 0 } : u.includes('refund-notices') ? { notices: [], totalAmount: 0 } : {})
    }))

    open()

    // the device's own amounts (not the placeholder ones) are on screen while the card check has not answered
    const two = await screen.findByRole('button', { name: 'Tip $2' })
    expect(urls.some(u => u.includes('check-payment-methods'))).toBe(true)
    expect(two).toBeDisabled()

    // a tap now neither sends a tip nor opens the card sheet
    fireEvent.click(two)
    expect(screen.queryByRole('dialog', { name: 'card sheet' })).toBeNull()
    expect(urls.filter(u => /\/api\/tips\/?$/.test(u))).toEqual([])

    finishCheck()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tip $2' })).not.toBeDisabled())
  })
})

describe('the first request, started before the page code finished loading', () => {
  const asResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), headers: new Headers() }) as any
  afterEach(() => { (window as any).__tipPreload = undefined })

  it('is used by the page instead of asking again', async () => {
    // getApiBaseUrl answers a local address in the test browser
    const url = `${(await import('@/utils/config')).getApiBaseUrl()}/api/devices/dev-1/public`
    ;(window as any).__tipPreload = { url, at: Date.now(), promise: Promise.resolve(asResponse(device)) }

    open()

    await screen.findByRole('button', { name: 'Tip $2' })
    expect(urls.filter(u => u.includes('/public'))).toEqual([]) // no second request for the performer
  })

  it('is used once, only for the same address, and only while fresh', async () => {
    const url = 'https://api.example/api/devices/dev-1/public'
    const make = (over: Record<string, unknown> = {}) => { (window as any).__tipPreload = { url, at: Date.now(), promise: Promise.resolve(asResponse(device)), ...over } }

    make(); expect(takeTipPreload(url)).not.toBeNull(); expect(takeTipPreload(url)).toBeNull()          // once
    make(); expect(takeTipPreload(url + '?performerId=x')).toBeNull()                                    // another address (a poster for another performer)
    make({ at: Date.now() - 120_000 }); expect(takeTipPreload(url)).toBeNull()                           // stale
    expect(takeTipPreload(url)).toBeNull()                                                               // nothing started
  })

  it('falls back to asking itself when the early request failed', async () => {
    const url = `${(await import('@/utils/config')).getApiBaseUrl()}/api/devices/dev-1/public`
    const failed = Promise.reject(new Error('offline'))
    failed.catch(() => {})
    ;(window as any).__tipPreload = { url, at: Date.now(), promise: failed }

    open()

    await screen.findByRole('button', { name: 'Tip $2' })
    expect(urls.filter(u => u.includes('/public'))).toHaveLength(1) // it asked once itself
  })
})

describe('the early-request script', () => {
  const root = join(__dirname, '..', '..', '..')
  const script = readFileSync(join(root, 'public', 'assets', 'tip-preload-v1.js'), 'utf8')

  it('is loaded by the page before the app code, and asks only for the tip page', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    const tag = html.match(/<script src="\/assets\/tip-preload-v1\.js"><\/script>/)
    expect(tag).not.toBeNull() // a plain script: not deferred, so it does not wait for the styles or the app code
    expect(html.indexOf('/assets/tip-preload-v1.js')).toBeLessThan(html.indexOf('type="module"'))
    expect(html.indexOf('/assets/tip-preload-v1.js')).toBeLessThan(html.indexOf('<title>'))
    expect(script).toContain("/^\\/tip\\/([A-Za-z0-9_-]{1,64})\\/?$/")
  })

  it('uses the same API addresses as the app, so the early request is the one the page would make', () => {
    const config = readFileSync(join(root, 'src', 'utils', 'config.ts'), 'utf8')
    for (const stage of ['dev', 'prod']) {
      const address = `https://uhxejjh8s1.execute-api.us-east-1.amazonaws.com/${stage}`
      expect(script).toContain(address)
      expect(config).toContain(address)
    }
  })

  it('sends nothing the page would not (no custom headers: the page asks the same way)', () => {
    expect(script).toMatch(/fetch\(url\)/)
    expect(script).not.toMatch(/headers/i)
  })
})

describe('what keeps the page fast (source checks)', () => {
  const root = join(__dirname, '..', '..')
  it('Stripe is imported through the pure build, which adds its script only when called, not when the file is loaded', () => {
    const source = readFileSync(join(root, 'components/PaymentSetupModal.tsx'), 'utf8')
    expect(source).toMatch(/import \{ loadStripe \} from '@stripe\/stripe-js\/pure'/)
    expect(source).not.toMatch(/import \{[^}]*loadStripe[^}]*\} from '@stripe\/stripe-js'/)
  })

  it('the page opens its connection to the API early', () => {
    const html = readFileSync(join(root, '..', 'index.html'), 'utf8')
    expect(html).toMatch(/<link rel="preconnect" href="https:\/\/uhxejjh8s1\.execute-api\.us-east-1\.amazonaws\.com"/)
  })
})
