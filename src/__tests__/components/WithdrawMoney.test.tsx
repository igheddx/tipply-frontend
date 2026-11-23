import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { WithdrawMoney } from '@/components/portal/WithdrawMoney'

const api = vi.hoisted(() => ({ withdrawalPreview: vi.fn(), withdraw: vi.fn(), dashboardLink: vi.fn() }))
vi.mock('@/services/payoutApi', () => ({ payoutApi: api }))

const ready = (over: Record<string, unknown> = {}) => ({
  data: { status: 'ready', available: 621.75, pending: 0, bankName: 'A+ FEDERAL', bankLast4: '6789', arrival: 'usually 1 to 4 business days', ...over }
})

const dialog = () => screen.getByRole('dialog', { name: 'Withdraw to your bank' })
const tapWithdraw = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
  return screen.findByRole('dialog', { name: 'Withdraw to your bank' })
}
const confirmButton = (amount: string) => within(dialog()).getByRole('button', { name: `Withdraw ${amount}` })

describe('WithdrawMoney', () => {
  beforeEach(() => {
    api.withdrawalPreview.mockReset()
    api.withdraw.mockReset()
  })

  it('shows only a button at first and asks the server for nothing', () => {
    render(<WithdrawMoney />)
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.withdrawalPreview).not.toHaveBeenCalled()
    expect(api.withdraw).not.toHaveBeenCalled()
  })

  it('looks at the balance when the button is tapped, and still sends nothing', async () => {
    api.withdrawalPreview.mockResolvedValue(ready())
    render(<WithdrawMoney />)

    const box = await tapWithdraw()

    await within(box).findByText('$621.75')
    expect(api.withdrawalPreview).toHaveBeenCalledTimes(1)
    expect(api.withdraw).not.toHaveBeenCalled()
  })

  it('says how much, where it goes, how long it takes and that there is no fee', async () => {
    api.withdrawalPreview.mockResolvedValue(ready({ available: 62175.5, pending: 40 }))
    render(<WithdrawMoney />)
    const box = await tapWithdraw()

    await within(box).findByText('$62,175.50') // with a thousands separator
    expect(box).toHaveTextContent('A+ FEDERAL ending 6789')
    expect(box).toHaveTextContent('usually arrives in 1 to 4 business days')
    expect(box).toHaveTextContent('There is no fee')
    expect(box).toHaveTextContent('$40.00 more is still coming from Stripe')
    expect(confirmButton('$62,175.50')).toBeInTheDocument()
  })

  it('sends exactly the amount it showed, with a key, and says it is on its way', async () => {
    api.withdrawalPreview.mockResolvedValue(ready())
    api.withdraw.mockResolvedValue({ data: { status: 'created', amount: 621.75, arrivalUtc: '2026-11-26T00:00:00Z' }, status: 200 })
    const onWithdrawn = vi.fn()
    render(<WithdrawMoney onWithdrawn={onWithdrawn} />)
    await tapWithdraw()
    await within(dialog()).findByText('$621.75')

    fireEvent.click(confirmButton('$621.75'))

    await within(dialog()).findByText(/is on its way to your bank account ending 6789/)
    expect(api.withdraw).toHaveBeenCalledTimes(1)
    const [amount, key] = api.withdraw.mock.calls[0]
    expect(amount).toBe(621.75)
    expect(key).toMatch(/^[A-Za-z0-9-]{8,64}$/)
    expect(dialog()).toHaveTextContent('around Thursday, November 26')
    expect(onWithdrawn).toHaveBeenCalledTimes(1) // the balances are read again

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a fast double tap sends one request, not two', async () => {
    api.withdrawalPreview.mockResolvedValue(ready())
    let resolve: (v: unknown) => void = () => {}
    api.withdraw.mockReturnValue(new Promise(r => { resolve = r }))
    render(<WithdrawMoney />)
    await tapWithdraw()
    await within(dialog()).findByText('$621.75')

    const button = confirmButton('$621.75')
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)

    expect(api.withdraw).toHaveBeenCalledTimes(1)
    resolve({ data: { status: 'created', amount: 621.75 }, status: 200 })
    await within(dialog()).findByText(/is on its way/)
  })

  it('cannot be closed while the withdrawal is being sent', async () => {
    api.withdrawalPreview.mockResolvedValue(ready())
    api.withdraw.mockReturnValue(new Promise(() => {}))
    render(<WithdrawMoney />)
    await tapWithdraw()
    await within(dialog()).findByText('$621.75')

    fireEvent.click(confirmButton('$621.75'))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.getByRole('dialog', { name: 'Withdraw to your bank' })).toBeInTheDocument()
    expect(within(dialog()).getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('Cancel closes it and nothing is sent', async () => {
    api.withdrawalPreview.mockResolvedValue(ready())
    render(<WithdrawMoney />)
    await tapWithdraw()
    await within(dialog()).findByText('$621.75')

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.withdraw).not.toHaveBeenCalled()
  })

  // --- keys: the same confirmation retried can never send twice; a new look is a new confirmation

  it('reuses the same key when the same confirmation is retried after a failure, so it can never send twice', async () => {
    api.withdrawalPreview.mockResolvedValue(ready())
    api.withdraw.mockResolvedValueOnce({ error: 'Your withdrawal could not be sent just now. Nothing was taken. Please try again in a moment.', status: 502 })
      .mockResolvedValue({ data: { status: 'created', amount: 621.75 }, status: 200 })
    render(<WithdrawMoney />)
    await tapWithdraw()
    await within(dialog()).findByText('$621.75')

    fireEvent.click(confirmButton('$621.75'))
    await within(dialog()).findByText(/Nothing was taken/)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Try again' }))
    await within(dialog()).findByText(/is on its way/)

    expect(api.withdraw).toHaveBeenCalledTimes(2)
    expect(api.withdraw.mock.calls[0][1]).toBe(api.withdraw.mock.calls[1][1])
    expect(api.withdraw.mock.calls[0][0]).toBe(api.withdraw.mock.calls[1][0])
  })

  it('uses a new key each time the balance is looked at again', async () => {
    api.withdrawalPreview.mockResolvedValue(ready())
    api.withdraw.mockResolvedValue({ data: { status: 'created', amount: 621.75 }, status: 200 })
    render(<WithdrawMoney />)

    await tapWithdraw()
    await within(dialog()).findByText('$621.75')
    fireEvent.click(confirmButton('$621.75'))
    await within(dialog()).findByText(/is on its way/)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Done' }))

    await tapWithdraw()
    await within(dialog()).findByText('$621.75')
    fireEvent.click(confirmButton('$621.75'))
    await waitFor(() => expect(api.withdraw).toHaveBeenCalledTimes(2))

    expect(api.withdraw.mock.calls[0][1]).not.toBe(api.withdraw.mock.calls[1][1])
  })

  it('a changed balance sends nothing, shows the new amount, and Review looks again with a new key', async () => {
    api.withdrawalPreview.mockResolvedValueOnce(ready()).mockResolvedValueOnce(ready({ available: 700 }))
    api.withdraw.mockResolvedValueOnce({ error: 'Your balance changed.', status: 409, raw: { code: 'balance_changed', amount: 700 } })
      .mockResolvedValue({ data: { status: 'created', amount: 700 }, status: 200 })
    render(<WithdrawMoney />)
    await tapWithdraw()
    await within(dialog()).findByText('$621.75')

    fireEvent.click(confirmButton('$621.75'))
    await within(dialog()).findByText(/Your balance changed, so nothing was sent/)
    expect(dialog()).toHaveTextContent('$700.00')

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Review' }))
    await within(dialog()).findByText('$700.00')
    fireEvent.click(confirmButton('$700.00'))
    await within(dialog()).findByText(/is on its way/)

    expect(api.withdraw.mock.calls[1][0]).toBe(700)
    expect(api.withdraw.mock.calls[0][1]).not.toBe(api.withdraw.mock.calls[1][1])
  })

  // --- every reason it cannot withdraw, with no way to confirm

  it('says nothing is ready yet, and what is still coming, with no confirm button', async () => {
    api.withdrawalPreview.mockResolvedValue({ data: { status: 'nothing_available', available: 0, pending: 621.75 } })
    render(<WithdrawMoney />)
    const box = await tapWithdraw()

    await within(box).findByText('There is nothing ready to withdraw yet.')
    expect(box).toHaveTextContent('$621.75 is on its way from Stripe and will be ready in a few days')
    expect(within(box).queryByRole('button', { name: /^Withdraw \$/ })).toBeNull()
  })

  it('tells an automatic account its money is sent for it, and points to Manage payouts', async () => {
    api.withdrawalPreview.mockResolvedValue({ data: { status: 'automatic', available: 0, pending: 0 } })
    render(<WithdrawMoney />)
    const box = await tapWithdraw()

    await within(box).findByText(/Your payouts are automatic/)
    expect(box).toHaveTextContent('choose manual in Manage payouts')
    expect(within(box).queryByRole('button', { name: /^Withdraw \$/ })).toBeNull()
  })

  it.each([
    ['no_bank', 'Add a bank account in your Stripe dashboard first'],
    ['not_ready', 'Finish setting up payouts first']
  ])('says what to do for %s, with no confirm button', async (status, words) => {
    api.withdrawalPreview.mockResolvedValue({ data: { status, available: 0, pending: 0 } })
    render(<WithdrawMoney />)
    const box = await tapWithdraw()

    await within(box).findByText(new RegExp(words))
    expect(within(box).queryByRole('button', { name: /^Withdraw \$/ })).toBeNull()
  })

  it('says to try again when the balance could not be read, and Try again looks once more', async () => {
    api.withdrawalPreview.mockResolvedValueOnce({ data: { status: 'unavailable', available: 0, pending: 0 } }).mockResolvedValue(ready())
    render(<WithdrawMoney />)
    const box = await tapWithdraw()
    await within(box).findByText(/could not be read just now/)

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Try again' }))

    await within(dialog()).findByText('$621.75')
    expect(api.withdrawalPreview).toHaveBeenCalledTimes(2)
  })

  it('shows a calm message when the request itself fails, never the raw error', async () => {
    api.withdrawalPreview.mockRejectedValue(new Error('socket hang up'))
    render(<WithdrawMoney />)
    const box = await tapWithdraw()

    await within(box).findByText(/could not be read just now/)
    expect(box.textContent).not.toMatch(/socket|hang up/)
  })

  it('shows the server’s calm message when sending is refused, and nothing is shown as sent', async () => {
    api.withdrawalPreview.mockResolvedValue(ready())
    api.withdraw.mockResolvedValue({ error: 'Add a bank account in your Stripe dashboard first, then you can withdraw.', status: 400 })
    const onWithdrawn = vi.fn()
    render(<WithdrawMoney onWithdrawn={onWithdrawn} />)
    await tapWithdraw()
    await within(dialog()).findByText('$621.75')

    fireEvent.click(confirmButton('$621.75'))

    await within(dialog()).findByText(/Add a bank account in your Stripe dashboard first/)
    expect(dialog().textContent).not.toMatch(/on its way/)
    expect(onWithdrawn).not.toHaveBeenCalled()
  })

  it('shows a calm message when the withdrawal request fails on the network, and says nothing was shown as sent', async () => {
    api.withdrawalPreview.mockResolvedValue(ready())
    api.withdraw.mockRejectedValue(new Error('socket hang up'))
    render(<WithdrawMoney />)
    await tapWithdraw()
    await within(dialog()).findByText('$621.75')

    fireEvent.click(confirmButton('$621.75'))

    await within(dialog()).findByText(/could not be read just now/)
    expect(dialog().textContent).not.toMatch(/socket|on its way/)
  })
})
