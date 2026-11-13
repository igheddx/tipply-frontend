import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { RefundRequestDialog } from '@/components/refunds/RefundRequestDialog'
import { RefundRequestsBanner } from '@/components/refunds/RefundRequestsBanner'
import { AdminRefunds } from '@/components/refunds/AdminRefunds'
import { ShowTipsSheet } from '@/components/shows/ShowTipsSheet'
import { AdminTipperBlock } from '@/components/refunds/AdminTipperBlock'

const refunds = vi.hoisted(() => ({ create: vi.fn(), mine: vi.fn(), mineSeen: vi.fn(), adminList: vi.fn(), approve: vi.fn(), decline: vi.fn() }))
vi.mock('@/services/refundRequestApi', async () => {
  const actual: any = await vi.importActual('@/services/refundRequestApi')
  return { ...actual, refundRequestApi: refunds }
})
const tipper = vi.hoisted(() => ({ details: vi.fn() }))
vi.mock('@/services/tipperApi', () => ({ tipperApi: tipper }))
const shows = vi.hoisted(() => ({ list: vi.fn(), tips: vi.fn() }))
vi.mock('@/services/showApi', () => ({ showApi: shows }))
const feedback = vi.hoisted(() => ({ toast: vi.fn(), confirm: vi.fn(async () => true) }))
vi.mock('@/components/ui/Feedback', () => ({ useFeedback: () => feedback, FeedbackProvider: ({ children }: any) => children }))
vi.mock('@/utils/pushAlerts', () => ({
  getPushSupport: () => 'needs-install', loadPushConfig: async () => ({ enabled: true }), notificationPermission: () => 'default',
  currentSubscription: async () => null, enablePushAlerts: async () => 'on', disablePushAlerts: async () => undefined, getEnableFailure: () => ''
}))

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString()

beforeEach(() => {
  Object.values(refunds).forEach(f => f.mockReset())
  Object.values(shows).forEach(f => f.mockReset())
  tipper.details.mockReset().mockResolvedValue({ data: { tipId: 't1', userId: 'u-1', browserId: 'b-1', email: null, cardBrand: 'visa', cardLast4: '4242', wallet: null, stripeStatus: 'ok', otherTips: [] } })
  feedback.toast.mockClear()
  feedback.confirm.mockClear().mockResolvedValue(true)
})

describe('RefundRequestDialog', () => {
  const tip = { tipId: 't1', amount: 50, createdAt: hoursAgo(2) }

  it('says plainly that Tipwave reviews it, shows the tip, and sends the reason and note', async () => {
    refunds.create.mockResolvedValue({ data: { status: 'pending' } })
    const onRequested = vi.fn(); const onClose = vi.fn()
    render(<RefundRequestDialog open tips={[tip]} onClose={onClose} onRequested={onRequested} />)

    expect(screen.getByText(/Tipwave reviews every request/)).toBeInTheDocument()
    expect(screen.getByText('$50.00')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Wrong amount' }))
    fireEvent.change(screen.getByLabelText(/Anything we should know/), { target: { value: ' Meant $5 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))

    await waitFor(() => expect(refunds.create).toHaveBeenCalledWith({ tipId: 't1', reason: 'wrong_amount', note: 'Meant $5', appVersion: 'dev' }))
    expect(onRequested).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
    expect(feedback.toast).toHaveBeenCalledWith(expect.stringContaining('Refund request sent'), 'success')
  })

  it('asks for a song request by its own id when the tip is only known through the request', async () => {
    refunds.create.mockResolvedValue({ data: {} })
    render(<RefundRequestDialog open tips={[{ songRequestId: 'r9', amount: 20, createdAt: hoursAgo(1) }]} onClose={() => {}} onRequested={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() => expect(refunds.create).toHaveBeenCalledWith({ songRequestId: 'r9', reason: 'mistake', note: undefined, appVersion: 'dev' }))
  })

  it('lets the performer choose which tip when a request has several', async () => {
    refunds.create.mockResolvedValue({ data: {} })
    render(<RefundRequestDialog open tips={[tip, { tipId: 't2', amount: 20, createdAt: hoursAgo(1) }]} onClose={() => {}} onRequested={() => {}} />)

    fireEvent.click(screen.getByText('$20.00'))
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))

    await waitFor(() => expect(refunds.create).toHaveBeenCalledWith(expect.objectContaining({ tipId: 't2' })))
  })

  it('shows the server’s reason and stays open when it is refused', async () => {
    refunds.create.mockResolvedValue({ error: 'Refund requests can be made for tips from the last 7 days.' })
    const onClose = vi.fn()
    render(<RefundRequestDialog open tips={[tip]} onClose={onClose} onRequested={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('last 7 days')
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('RefundRequestsBanner (performer home screen)', () => {
  const pending = { id: 'a', tipId: 't1', amount: 50, tipAt: hoursAgo(3), reason: 'mistake', status: 'pending', requestedAt: hoursAgo(1) }

  it('shows nothing when nothing is waiting', async () => {
    refunds.mine.mockResolvedValue({ data: { requests: [] } })
    const { container } = render(<RefundRequestsBanner />)
    await waitFor(() => expect(refunds.mine).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('lists what is waiting for review, with the amount and when the tip came in', async () => {
    refunds.mine.mockResolvedValue({ data: { requests: [pending, { ...pending, id: 'b', amount: 20 }] } })
    render(<RefundRequestsBanner />)

    expect(await screen.findByText('2 refund requests are waiting for review')).toBeInTheDocument()
    expect(screen.getByText(/\$50\.00 tip from/)).toBeInTheDocument()
    expect(screen.getByText(/\$20\.00 tip from/)).toBeInTheDocument()
  })

  it('tells the performer kindly when one was not approved, once, with the reason', async () => {
    refunds.mine.mockResolvedValue({ data: { requests: [{ ...pending, status: 'declined', declineReason: 'The tipper meant to tip' }] } })
    refunds.mineSeen.mockResolvedValue({})
    render(<RefundRequestsBanner />)

    expect(await screen.findByText(/was not approved/)).toBeInTheDocument()
    expect(screen.getByText('The tipper meant to tip')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))

    expect(refunds.mineSeen).toHaveBeenCalledWith(['a'])
    expect(screen.queryByText(/was not approved/)).toBeNull()
  })
})

describe('ShowTipsSheet', () => {
  const show = { id: 's1', name: null, venueName: null, startedAt: hoursAgo(5), endedAt: hoursAgo(1), isLive: true, tipCount: 3, gross: 120, waitingGross: 0, fees: 0, youKeep: 0, refundedCount: 0, refundedGross: 0 }
  const tip = (id: string, hours: number, amount: number, over: Record<string, unknown> = {}) => ({ id, createdAt: hoursAgo(hours), amount, status: 'processed', hasSongRequest: false, ...over })

  it('lists every tip newest first with the time it came in, and says which came with a song', async () => {
    shows.list.mockResolvedValue({ data: { shows: [show] } })
    shows.tips.mockResolvedValue({ data: { tips: [tip('a', 4, 20), tip('b', 3, 50, { hasSongRequest: true }), tip('c', 2, 5)] } })
    render(<ShowTipsSheet open initialShowId="s1" onClose={() => {}} />)

    const list = await screen.findByRole('list', { name: 'Tips in this show' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('$5.00')
    expect(rows[2]).toHaveTextContent('$20.00')
    expect(within(list).getAllByText('Tip only')).toHaveLength(2)
    expect(within(list).getByText('Song request')).toBeInTheDocument()
  })

  it('offers Request refund only on a charged recent tip with nothing asked yet', async () => {
    shows.list.mockResolvedValue({ data: { shows: [show] } })
    shows.tips.mockResolvedValue({
      data: {
        tips: [
          tip('ok', 1, 50),
          tip('refunded', 2, 100, { status: 'refunded' }),
          tip('waiting', 1, 10, { status: 'pending' }),
          tip('asked', 3, 20, { refundRequest: 'pending' }),
          tip('declined', 3, 20, { refundRequest: 'declined' }),
          tip('old', 24 * 9, 5)
        ]
      }
    })
    render(<ShowTipsSheet open initialShowId="s1" onClose={() => {}} />)

    await screen.findByRole('list', { name: 'Tips in this show' })
    expect(screen.getAllByRole('button', { name: 'Request refund' })).toHaveLength(1)
    expect(screen.getByText('Refunded')).toBeInTheDocument()
    expect(screen.getByText('Waiting')).toBeInTheDocument()
    expect(screen.getByText('Refund requested')).toBeInTheDocument()
    expect(screen.getByText('Not refunded')).toBeInTheDocument()
  })

  it('opens the request for that tip, and reloads the list after it is sent', async () => {
    shows.list.mockResolvedValue({ data: { shows: [show] } })
    shows.tips.mockResolvedValue({ data: { tips: [tip('ok', 1, 50)] } })
    refunds.create.mockResolvedValue({ data: {} })
    render(<ShowTipsSheet open initialShowId="s1" onClose={() => {}} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Request refund' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Send request' }))

    await waitFor(() => expect(refunds.create).toHaveBeenCalledWith(expect.objectContaining({ tipId: 'ok' })))
    await waitFor(() => expect(shows.tips.mock.calls.length).toBeGreaterThan(1))
  })

  it('lets the performer pick an earlier show', async () => {
    shows.list.mockResolvedValue({ data: { shows: [show, { ...show, id: 's0', isLive: false, startedAt: hoursAgo(30) }] } })
    shows.tips.mockResolvedValue({ data: { tips: [] } })
    render(<ShowTipsSheet open initialShowId="s1" onClose={() => {}} />)
    await screen.findByText('No tips in this show yet.')

    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 's0' } })

    await waitFor(() => expect(shows.tips).toHaveBeenLastCalledWith('s0'))
  })
})

describe('AdminRefunds', () => {
  const req = (over: Record<string, unknown> = {}) => ({
    id: 'r1', tipId: 't1', amount: 50, tipAt: hoursAgo(3), reason: 'mistake', note: 'Tapped twice', status: 'pending', requestedAt: hoursAgo(1),
    profileId: 'p1', performerName: 'Dave Lovett Piano', tipStatus: 'processed', hasSongRequest: false, ...over
  })

  it('says when the decided history is cut, instead of quietly showing only part of it', async () => {
    const decided = Array.from({ length: 100 }, (_, i) => req({ id: `d${i}`, status: 'approved', decidedAt: hoursAgo(2 + i / 100), requestedAt: hoursAgo(30) }))
    refunds.adminList.mockResolvedValue({ data: { pendingCount: 0, requests: decided, decidedTotal: 450, decidedShown: 100, directRefunds: [], directRefundsTotal: 0 } })
    render(<AdminRefunds />)

    expect(await screen.findByText('Showing the newest 100 of 450 refunded or declined in the last 30 days')).toBeInTheDocument()
  })

  it('does not claim anything was cut when everything is shown', async () => {
    const decided = [req({ id: 'd1', status: 'declined', decidedAt: hoursAgo(2), requestedAt: hoursAgo(30) })]
    refunds.adminList.mockResolvedValue({ data: { pendingCount: 0, requests: decided, decidedTotal: 1, decidedShown: 1, directRefunds: [], directRefundsTotal: 0 } })
    render(<AdminRefunds />)

    expect(await screen.findByText('Everything refunded or declined in the last 30 days')).toBeInTheDocument()
    expect(screen.queryByText(/Showing the newest/)).toBeNull()
  })

  it('shows every waiting request, including a long queue', async () => {
    const waiting = Array.from({ length: 250 }, (_, i) => req({ id: `w${i}`, tipId: `t${i}`, performerName: `Performer ${i}`, requestedAt: hoursAgo(300 - i) }))
    refunds.adminList.mockResolvedValue({ data: { pendingCount: 250, requests: waiting, decidedTotal: 0, directRefundsTotal: 0 } })
    render(<AdminRefunds />)

    expect(await screen.findByText('Performer 0')).toBeInTheDocument()
    expect(screen.getByText('Performer 249')).toBeInTheDocument() // the last one is there, not cut at a page
  })

  it('lists what is waiting with the performer, amount, reason and their words', async () => {
    refunds.adminList.mockResolvedValue({ data: { pendingCount: 1, requests: [req()] } })
    render(<AdminRefunds />)

    expect(await screen.findByText('Dave Lovett Piano')).toBeInTheDocument()
    expect(screen.getByText('$50.00')).toBeInTheDocument()
    expect(screen.getByText('The tipper tapped by mistake')).toBeInTheDocument()
    expect(screen.getByText('“Tapped twice”')).toBeInTheDocument()
    expect(screen.getByText('Tip only')).toBeInTheDocument()
  })

  it('approves only after confirming, then says everyone was told', async () => {
    refunds.adminList.mockResolvedValue({ data: { pendingCount: 1, requests: [req()] } })
    refunds.approve.mockResolvedValue({ data: {} })
    render(<AdminRefunds />)

    fireEvent.click(await screen.findByRole('button', { name: 'Approve and refund' }))

    await waitFor(() => expect(feedback.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Refund $50.00?' })))
    await waitFor(() => expect(refunds.approve).toHaveBeenCalledWith('r1'))
    expect(feedback.toast).toHaveBeenCalledWith(expect.stringContaining('performer and the tipper have been told'), 'success')
  })

  it('does not refund when the admin cancels', async () => {
    refunds.adminList.mockResolvedValue({ data: { pendingCount: 1, requests: [req()] } })
    feedback.confirm.mockResolvedValue(false)
    render(<AdminRefunds />)

    fireEvent.click(await screen.findByRole('button', { name: 'Approve and refund' }))

    await waitFor(() => expect(feedback.confirm).toHaveBeenCalled())
    expect(refunds.approve).not.toHaveBeenCalled()
  })

  it('shows Stripe’s reason when the refund is refused, and keeps the request waiting', async () => {
    refunds.adminList.mockResolvedValue({ data: { pendingCount: 1, requests: [req()] } })
    refunds.approve.mockResolvedValue({ error: 'Stripe could not refund this tip: insufficient funds' })
    render(<AdminRefunds />)

    fireEvent.click(await screen.findByRole('button', { name: 'Approve and refund' }))

    await waitFor(() => expect(feedback.toast).toHaveBeenCalledWith('Stripe could not refund this tip: insufficient funds', 'error'))
  })

  it('declines with an optional reason the performer will see', async () => {
    refunds.adminList.mockResolvedValue({ data: { pendingCount: 1, requests: [req()] } })
    refunds.decline.mockResolvedValue({ data: {} })
    render(<AdminRefunds />)

    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }))
    fireEvent.change(await screen.findByLabelText('Reason'), { target: { value: ' The tipper confirmed ' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Decline' }).pop()!)

    await waitFor(() => expect(refunds.decline).toHaveBeenCalledWith('r1', 'The tipper confirmed'))
  })

  it('cannot approve a tip that is not charged, and lists what was decided recently', async () => {
    refunds.adminList.mockResolvedValue({
      data: {
        pendingCount: 1,
        requests: [req({ tipStatus: 'refunded' }), req({ id: 'r2', status: 'declined', declineReason: 'Meant to tip', decidedAt: hoursAgo(1) }), req({ id: 'r3', status: 'approved', decidedAt: hoursAgo(2) })]
      }
    })
    render(<AdminRefunds />)

    expect(await screen.findByRole('button', { name: 'Approve and refund' })).toBeDisabled()
    expect(screen.getByText('Recently decided')).toBeInTheDocument()
    expect(screen.getByText('Meant to tip')).toBeInTheDocument()
    expect(screen.getByText('Refunded')).toBeInTheDocument()
  })

  it('also lists refunds the admin made directly, merged by time with the decided requests, saying how each happened', async () => {
    refunds.adminList.mockResolvedValue({
      data: {
        pendingCount: 0,
        historyDays: 30,
        requests: [req({ id: 'r1', status: 'approved', decidedAt: hoursAgo(5) }), req({ id: 'r2', status: 'declined', declineReason: 'Meant to tip', decidedAt: hoursAgo(1) })],
        directRefunds: [{ tipId: 'd1', profileId: 'p1', performerName: 'Sam Singer', amount: 20, tipAt: hoursAgo(30), refundedAt: hoursAgo(3), hasSongRequest: false }]
      }
    })
    render(<AdminRefunds />)

    const list = await screen.findByRole('list', { name: 'Recently decided' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('Declined')              // newest: the decline an hour ago
    expect(rows[1]).toHaveTextContent('Sam Singer')            // then the direct refund
    expect(rows[1]).toHaveTextContent('by an admin, no request')
    expect(rows[2]).toHaveTextContent('after a request')       // then the approved request
    expect(screen.getByText('Everything refunded or declined in the last 30 days')).toBeInTheDocument()
  })

  it('shows direct refunds even when there are no requests at all', async () => {
    refunds.adminList.mockResolvedValue({
      data: { pendingCount: 0, requests: [], directRefunds: [{ tipId: 'd1', profileId: 'p1', performerName: 'Sam Singer', amount: 20, tipAt: hoursAgo(30), refundedAt: hoursAgo(3), hasSongRequest: false }] }
    })
    render(<AdminRefunds />)

    expect(await screen.findByText('Sam Singer')).toBeInTheDocument()
    expect(screen.getByText('Nothing is waiting')).toBeInTheDocument()
  })

  it('says nothing is waiting when the list is empty, and explains how phone alerts need the Home Screen', async () => {
    refunds.adminList.mockResolvedValue({ data: { pendingCount: 0, requests: [] } })
    render(<AdminRefunds />)

    expect(await screen.findByText('Nothing is waiting')).toBeInTheDocument()
    expect(screen.getByText('Add Tipwave to your Home Screen first')).toBeInTheDocument()
  })
})

describe('the admin’s tipper block (performers never see any of it)', () => {
  const details = (over: Record<string, unknown> = {}) => ({
    tipId: 't1', userId: '3e52f097-3044-48e0-8428-64753b33e40c', browserId: '4f4f22f4-8710-4720-94bb-47e49ee336fa',
    email: 'jane@example.com', cardBrand: 'visa', cardLast4: '4242', wallet: 'apple_pay', stripeStatus: 'ok', otherTips: [], ...over
  })

  it('keeps the ids, email and card together as one block', async () => {
    tipper.details.mockResolvedValue({ data: details() })
    render(<AdminTipperBlock tipId="t1" />)

    const block = await screen.findByLabelText('Who gave this tip')
    expect(block).toHaveTextContent('jane@example.com')
    expect(block).toHaveTextContent('Visa ···· 4242 · Apple Pay')
    expect(block).toHaveTextContent('3e52f097-3044-48e0-8428-64753b33e40c')
    expect(block).toHaveTextContent('4f4f22f4-8710-4720-94bb-47e49ee336fa')
  })

  it('says plainly when there is no email, and still shows the card and the ids', async () => {
    tipper.details.mockResolvedValue({ data: details({ email: null, wallet: null, cardBrand: 'mastercard', cardLast4: '4444' }) })
    render(<AdminTipperBlock tipId="t1" />)

    const block = await screen.findByLabelText('Who gave this tip')
    expect(block).toHaveTextContent('None. Paid with a typed card.')
    expect(block).toHaveTextContent('Mastercard ···· 4444')
  })

  it('explains when Stripe could not be read, or the tip was paid in the other mode, without hiding the ids', async () => {
    tipper.details.mockResolvedValue({ data: details({ email: null, cardLast4: null, stripeStatus: 'unavailable' }) })
    const { unmount } = render(<AdminTipperBlock tipId="t1" />)
    expect(await screen.findByText(/Stripe’s details could not be read just now/)).toBeInTheDocument()
    expect(screen.getByText('3e52f097-3044-48e0-8428-64753b33e40c')).toBeInTheDocument()
    unmount()

    tipper.details.mockResolvedValue({ data: details({ email: null, cardLast4: null, stripeStatus: 'mode_mismatch' }) })
    render(<AdminTipperBlock tipId="t1" />)
    expect(await screen.findByText(/paid in the other Stripe mode/)).toBeInTheDocument()
  })

  it('lists the same tipper’s other tips to this performer, so similar amounts can be told apart', async () => {
    tipper.details.mockResolvedValue({ data: details({ otherTips: [{ tipId: 'o1', createdAt: hoursAgo(2), amount: 50, status: 'processed' }, { tipId: 'o2', createdAt: hoursAgo(5), amount: 20, status: 'refunded' }] }) })
    render(<AdminTipperBlock tipId="t1" />)

    const list = await screen.findByRole('list', { name: 'Other tips from this tipper' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('$50.00')
    expect(rows[1]).toHaveTextContent('$20.00 · refunded')
  })

  it('offers to show every tip from this tipper, handing back their id', async () => {
    tipper.details.mockResolvedValue({ data: details() })
    const onShowAll = vi.fn()
    render(<AdminTipperBlock tipId="t1" onShowAllTips={onShowAll} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Show all tips from this tipper' }))

    expect(onShowAll).toHaveBeenCalledWith(expect.objectContaining({ userId: '3e52f097-3044-48e0-8428-64753b33e40c' }))
  })

  it('says so when the details cannot be loaded', async () => {
    tipper.details.mockResolvedValue({ error: 'nope' })
    render(<AdminTipperBlock tipId="t1" />)
    expect(await screen.findByText('Could not load who gave this tip.')).toBeInTheDocument()
  })

  it('shows the tipper block on each waiting refund request, so similar tips can be told apart', async () => {
    refunds.adminList.mockResolvedValue({
      data: { pendingCount: 1, requests: [{ id: 'r1', tipId: 'tip-9', amount: 50, tipAt: hoursAgo(3), reason: 'mistake', note: null, status: 'pending', requestedAt: hoursAgo(1), profileId: 'p1', performerName: 'Dave Lovett Piano', tipStatus: 'processed', hasSongRequest: false, tipperUserId: '3e52f097-3044-48e0-8428-64753b33e40c' }] }
    })
    render(<AdminRefunds />)

    expect(await screen.findByLabelText('Who gave this tip')).toHaveTextContent('Visa ···· 4242')
    expect(tipper.details).toHaveBeenCalledWith('tip-9')
  })

  it('shows a performer nothing about who tipped: only the time, amount and kind of tip', async () => {
    shows.list.mockResolvedValue({ data: { shows: [{ id: 's1', name: null, venueName: null, startedAt: hoursAgo(5), endedAt: hoursAgo(1), isLive: true, tipCount: 2, gross: 100, waitingGross: 0, fees: 0, youKeep: 0, refundedCount: 0, refundedGross: 0 }] } })
    shows.tips.mockResolvedValue({ data: { tips: [
      { id: 'a', createdAt: hoursAgo(2), amount: 50, status: 'processed', hasSongRequest: false },
      { id: 'b', createdAt: hoursAgo(1), amount: 50, status: 'processed', hasSongRequest: false }
    ] } })
    render(<ShowTipsSheet open initialShowId="s1" onClose={() => {}} />)

    const list = await screen.findByRole('list', { name: 'Tips in this show' })
    expect(list.textContent).not.toMatch(/tipper/i)
    expect(tipper.details).not.toHaveBeenCalled() // the admin lookup is never made from a performer screen
  })
})
