import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ShowPlatformMix } from '@/components/platform/ShowPlatformMix'

const api = vi.hoisted(() => ({ show: vi.fn(), admin: vi.fn() }))
vi.mock('@/services/platformMixApi', () => ({ platformMixApi: api }))

const row = (key: string, over: Record<string, number> = {}) => ({
  key, tippers: 0, tips: 0, totalAmount: 0, walletTippers: 0, walletTips: 0, walletAmount: 0, songRequesters: 0, songRequests: 0, ...over
})
const way = (tippers: number, tips: number, totalAmount: number) => ({ tippers, tips, totalAmount })

const showMix = (ios: number, android: number) => ({
  data: {
    days: 0,
    tippers: ios + android,
    rows: [row('ios', { tippers: ios, tips: ios * 2, totalAmount: ios * 20 }), row('android', { tippers: android, tips: android, totalAmount: android * 10 }), row('desktop'), row('unknown')],
    wallet: way(ios, ios * 2, ios * 20),
    card: way(android, android, android * 10),
    estimatedTips: 0,
    walletReach: { known: 0, available: 0, usedWallet: 0, typedCardInstead: 0 }
  }
})

const tipper = (number: number, over: Record<string, unknown> = {}) => ({
  number, phone: 'ios', tips: 1, totalAmount: 10, firstTipAt: '2026-11-22T03:40:00Z', lastTipAt: '2026-11-22T04:10:00Z',
  walletTips: 1, cardTips: 0, estimatedTips: 0, songRequests: 1, names: [] as string[], ...over
})

const withList = (list: ReturnType<typeof tipper>[] | null, requestNames = 0) => {
  const base = showMix(list ? list.length : 0, 0)
  return { data: { ...base.data, tipperList: list, requestNames } }
}

const toggle = () => screen.getByRole('button', { name: /Phones and how they pay/ })

describe('ShowPlatformMix', () => {
  beforeEach(() => {
    api.show.mockReset()
    api.admin.mockReset()
  })

  it('is closed at first and asks the server for nothing, so the show page is exactly as quick as before', () => {
    render(<ShowPlatformMix profileId="p1" showId="s1" />)

    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(api.show).not.toHaveBeenCalled()
    expect(screen.queryByTestId('phones-ios')).toBeNull()
  })

  it('reads the show once when it is opened and shows the same breakdown as the platform card', async () => {
    api.show.mockResolvedValue(showMix(6, 4))
    render(<ShowPlatformMix profileId="p1" showId="s1" />)

    fireEvent.click(toggle())

    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByTestId('phones-ios')).toBeInTheDocument()
    expect(api.show).toHaveBeenCalledTimes(1)
    expect(api.show).toHaveBeenCalledWith('p1', 's1')
    expect(within(screen.getByTestId('phones-ios')).getByText('60%')).toBeInTheDocument() // 6 of 10
    expect(within(screen.getByTestId('pay-wallet')).getByText('75%')).toBeInTheDocument() // 12 of 16 tips
    expect(screen.getByText(/Showing 10 tippers in this show\./)).toBeInTheDocument()
  })

  it('does not read it again when it is closed and opened', async () => {
    api.show.mockResolvedValue(showMix(3, 1))
    render(<ShowPlatformMix profileId="p1" showId="s1" />)

    fireEvent.click(toggle())
    await screen.findByTestId('phones-ios')
    fireEvent.click(toggle()) // close
    expect(screen.queryByTestId('phones-ios')).toBeNull()
    fireEvent.click(toggle()) // open again
    expect(await screen.findByTestId('phones-ios')).toBeInTheDocument()
    expect(api.show).toHaveBeenCalledTimes(1)
  })

  it('reads the newly chosen show when the admin switches shows while it is open, and not the old one again', async () => {
    api.show.mockImplementation(async (_p: string, showId: string) => (showId === 's1' ? showMix(6, 4) : showMix(1, 1)))
    const { rerender } = render(<ShowPlatformMix profileId="p1" showId="s1" />)
    fireEvent.click(toggle())
    expect(await screen.findByText(/Showing 10 tippers/)).toBeInTheDocument()

    rerender(<ShowPlatformMix profileId="p1" showId="s2" />)
    expect(await screen.findByText(/Showing 2 tippers/)).toBeInTheDocument()
    expect(api.show).toHaveBeenCalledTimes(2)

    rerender(<ShowPlatformMix profileId="p1" showId="s1" />) // back to the first: already read
    expect(await screen.findByText(/Showing 10 tippers/)).toBeInTheDocument()
    expect(api.show).toHaveBeenCalledTimes(2)
  })

  it('stays closed when the show changes, and reads the new show only when it is opened', async () => {
    api.show.mockResolvedValue(showMix(2, 2))
    const { rerender } = render(<ShowPlatformMix profileId="p1" showId="s1" />)

    rerender(<ShowPlatformMix profileId="p1" showId="s2" />)
    expect(api.show).not.toHaveBeenCalled()

    fireEvent.click(toggle())
    await screen.findByTestId('phones-ios')
    expect(api.show).toHaveBeenCalledTimes(1)
    expect(api.show).toHaveBeenCalledWith('p1', 's2')
  })

  it('says so when nobody tipped in the show', async () => {
    api.show.mockResolvedValue(showMix(0, 0))
    render(<ShowPlatformMix profileId="p1" showId="s1" />)
    fireEvent.click(toggle())

    expect(await screen.findByText('Nobody tipped in this show.')).toBeInTheDocument()
    expect(screen.queryByText('NaN%')).toBeNull()
  })

  it('shows a calm message when it cannot be loaded, and tries again when it is closed and reopened', async () => {
    api.show.mockResolvedValueOnce({ error: 'Not allowed', status: 403 }).mockResolvedValue(showMix(2, 2))
    render(<ShowPlatformMix profileId="p1" showId="s1" />)

    fireEvent.click(toggle())
    expect(await screen.findByText(/numbers could not be loaded/)).toBeInTheDocument()

    fireEvent.click(toggle()) // close
    fireEvent.click(toggle()) // open again: a new try
    expect(await screen.findByTestId('phones-ios')).toBeInTheDocument()
    expect(api.show).toHaveBeenCalledTimes(2)
  })

  describe('the list of phones in the show', () => {
    const open = async (data: ReturnType<typeof withList>) => {
      api.show.mockResolvedValue(data)
      render(<ShowPlatformMix profileId="p1" showId="s1" />)
      fireEvent.click(toggle())
      return screen.findByTestId('show-tippers')
    }

    it('has one numbered row for each phone, with its tips, dollars, times, way of paying and names', async () => {
      const box = await open(
        withList(
          [
            tipper(1, { phone: 'ios', tips: 9, totalAmount: 85, walletTips: 9, songRequests: 8, names: ['Cody', 'Amy'] }),
            tipper(2, { phone: 'android', tips: 1, totalAmount: 5, walletTips: 0, cardTips: 1, songRequests: 0 })
          ],
          2
        )
      )

      const first = within(box).getByTestId('show-tipper-1')
      expect(first).toHaveTextContent('Phone 1')
      expect(first).toHaveTextContent('iPhone / iPad')
      expect(first).toHaveTextContent('$85.00')
      expect(first).toHaveTextContent('Apple / Google Pay')
      expect(first).toHaveTextContent('Cody, Amy')
      expect(first).toHaveTextContent(/\d{1,2}:\d{2}/) // first and last tip times
      const second = within(box).getByTestId('show-tipper-2')
      expect(second).toHaveTextContent('Android')
      expect(second).toHaveTextContent('Card')
      expect(second).toHaveTextContent('–') // no names
    })

    it('adds the rows up so they can be compared with the show total and with Stripe', async () => {
      const box = await open(withList([tipper(1, { tips: 9, totalAmount: 85 }), tipper(2, { tips: 3, totalAmount: 20 }), tipper(3, { tips: 1, totalAmount: 5 })]))

      const total = within(box).getByTestId('show-tippers-total')
      expect(total).toHaveTextContent('3 phones')
      expect(total).toHaveTextContent('13')
      expect(total).toHaveTextContent('$110.00')
      expect(within(box).getByText(/each phone is one customer in Stripe/)).toBeInTheDocument()
    })

    it('marks a phone whose way of paying is estimated, and says Both for one that used both', async () => {
      const box = await open(
        withList([tipper(1, { walletTips: 2, cardTips: 0, estimatedTips: 2 }), tipper(2, { walletTips: 1, cardTips: 1, estimatedTips: 0 })])
      )

      expect(within(box).getByTestId('show-tipper-1')).toHaveTextContent('Apple / Google Pay (estimated)')
      expect(within(box).getByTestId('show-tipper-2')).toHaveTextContent('Both')
    })

    it('says when there are more names than phones, meaning phones were shared', async () => {
      const box = await open(withList([tipper(1, { names: ['Ann', 'Bo', 'Cy', 'Di'] })], 4))
      expect(within(box).getByTestId('names-note')).toHaveTextContent('4 different names were typed on song requests, more than the 1 phone that tipped, so some phones were shared by more than one person')
    })

    it('says plainly when the names match the phones, or when no names were typed', async () => {
      let box = await open(withList([tipper(1, { names: ['Ann'] }), tipper(2, { names: ['Bo'] })], 2))
      expect(within(box).getByTestId('names-note')).toHaveTextContent('2 different names were typed on song requests, across 2 phones.')
    })

    it('says no names were typed when there are none', async () => {
      const box = await open(withList([tipper(1)], 0))
      expect(within(box).getByTestId('names-note')).toHaveTextContent('No names were typed on this show’s song requests.')
    })

    it('shows a long list in full, to the last phone', async () => {
      const many = Array.from({ length: 120 }, (_, i) => tipper(i + 1))
      const box = await open(withList(many))
      expect(within(box).getByTestId('show-tipper-120')).toHaveTextContent('Phone 120')
      expect(within(box).getByTestId('show-tippers-total')).toHaveTextContent('120 phones')
    })

    it('leaves the list out when the server does not send one', async () => {
      api.show.mockResolvedValue(showMix(2, 2))
      render(<ShowPlatformMix profileId="p1" showId="s1" />)
      fireEvent.click(toggle())
      await screen.findByTestId('phones-ios')
      expect(screen.queryByTestId('show-tippers')).toBeNull()
    })
  })

  it('shows a placeholder while the numbers load', async () => {
    let resolve: (v: unknown) => void = () => {}
    api.show.mockReturnValue(new Promise(r => { resolve = r }))
    render(<ShowPlatformMix profileId="p1" showId="s1" />)

    fireEvent.click(toggle())
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
    resolve(showMix(1, 1))
    await waitFor(() => expect(screen.getByTestId('phones-ios')).toBeInTheDocument())
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
  })
})
