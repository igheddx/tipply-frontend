import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { TipperFailedTipNotice } from '@/components/tip/TipperFailedTipNotice'

const api = vi.hoisted(() => ({ forTipper: vi.fn(), tipperSeen: vi.fn() }))
vi.mock('@/services/failedTipNoticeApi', () => ({ failedTipNoticeApi: api }))

const notice = (id: string, amount = 20, name = 'Dave Lovett Piano') => ({ id, amount, failedAt: '2026-11-20T15:00:00Z', performerName: name })

describe('TipperFailedTipNotice', () => {
  beforeEach(() => {
    Object.values(api).forEach(f => f.mockReset())
    api.tipperSeen.mockResolvedValue(undefined)
  })

  it('shows nothing when no tip failed', async () => {
    api.forTipper.mockResolvedValue({ notices: [] })
    const { container } = render(<TipperFailedTipNotice userId="u1" onChangeCard={() => {}} />)
    await waitFor(() => expect(api.forTipper).toHaveBeenCalledWith('u1'))
    expect(container).toBeEmptyDOMElement()
    expect(api.tipperSeen).not.toHaveBeenCalled()
  })

  it('does not ask until the tipper id is known', () => {
    render(<TipperFailedTipNotice userId="" onChangeCard={() => {}} />)
    expect(api.forTipper).not.toHaveBeenCalled()
  })

  it('says plainly which tip did not go through, with no blame', async () => {
    api.forTipper.mockResolvedValue({ notices: [notice('a')] })
    render(<TipperFailedTipNotice userId="u1" onChangeCard={() => {}} />)

    expect(await screen.findByText("A tip didn't go through")).toBeInTheDocument()
    expect(screen.getByText(/Your \$20\.00 tip to Dave Lovett Piano on November 20 didn't go through, so they weren't paid/)).toBeInTheDocument()
    expect(screen.getByText(/You're welcome to add a different card/)).toBeInTheDocument()
  })

  it('adds several together into one message', async () => {
    api.forTipper.mockResolvedValue({ notices: [notice('a'), notice('b', 50)] })
    render(<TipperFailedTipNotice userId="u1" onChangeCard={() => {}} />)

    expect(await screen.findByText(/Your 2 tips to Dave Lovett Piano \(\$70\.00 in all\)/)).toBeInTheDocument()
  })

  it('is marked seen the moment it is shown, so it can never come back, even if the tipper does nothing', async () => {
    api.forTipper.mockResolvedValue({ notices: [notice('a'), notice('b')] })
    render(<TipperFailedTipNotice userId="u1" onChangeCard={() => {}} />)

    await screen.findByText("A tip didn't go through")
    await waitFor(() => expect(api.tipperSeen).toHaveBeenCalledWith('u1', ['a', 'b']))
    expect(api.tipperSeen).toHaveBeenCalledTimes(1)
  })

  it('Dismiss closes it', async () => {
    api.forTipper.mockResolvedValue({ notices: [notice('a')] })
    render(<TipperFailedTipNotice userId="u1" onChangeCard={() => {}} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText("A tip didn't go through")).toBeNull()
  })

  it('"Use a different card" closes it and opens the card sheet', async () => {
    api.forTipper.mockResolvedValue({ notices: [notice('a')] })
    const onChangeCard = vi.fn()
    render(<TipperFailedTipNotice userId="u1" onChangeCard={onChangeCard} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Use a different card' }))
    expect(onChangeCard).toHaveBeenCalledTimes(1)
    expect(screen.queryByText("A tip didn't go through")).toBeNull()
  })
})
