import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import TipButtonsCard from '@/components/TipButtonsCard'

const amounts = [5, 10, 15, 20, 50, 100]
const devices = [{ id: 'd1', nickname: 'Stage' }]
const lights: Record<string, Record<number, string>> = { d1: { 5: 'effect1', 10: 'effect2', 15: 'effect3', 20: 'effect4', 50: 'effect5', 100: 'effect6' }, d2: { 5: 'effect6', 10: 'effect5', 15: 'effect4', 20: 'effect3', 50: 'effect2', 100: 'effect1' } }

const setup = (over: Partial<React.ComponentProps<typeof TipButtonsCard>> = {}) => {
  const props = {
    amounts, devices, lightFor: (d: string, a: number) => lights[d]?.[a] ?? 'effect1', onLightChange: vi.fn(),
    savingAmounts: false, onSaveAmounts: vi.fn(), onResetAmounts: vi.fn(), ...over
  }
  render(<TipButtonsCard {...props} />)
  return props
}

describe('TipButtonsCard', () => {
  it('lists the six buttons left to right, each with the light it fires', () => {
    setup()
    const rows = within(screen.getByRole('list', { name: 'Tip buttons, left to right' })).getAllByRole('listitem')
    expect(rows).toHaveLength(6)
    const leading = rows.map(r => (r.textContent ?? '').match(/^\d\$\d+/)?.[0])
    expect(leading).toEqual(['1$5', '2$10', '3$15', '4$20', '5$50', '6$100'])
    expect(screen.getByLabelText('Light for the $5 button')).toHaveValue('effect1')
    expect(screen.getByLabelText('Light for the $20 button')).toHaveValue('effect4')
    expect(screen.getByLabelText('Light for the $100 button')).toHaveValue('effect6')
  })

  it('changes a light right in its row, for that device and amount', () => {
    const props = setup()
    fireEvent.change(screen.getByLabelText('Light for the $15 button'), { target: { value: 'effect6' } })
    expect(props.onLightChange).toHaveBeenCalledWith('d1', 15, 'effect6')
  })

  it('offers all six effects in each row', () => {
    setup()
    const select = screen.getByLabelText('Light for the $10 button')
    expect(within(select).getAllByRole('option').map(o => o.textContent)).toEqual(['Flash', 'Swirl', 'Breathing', 'Light Effect 4', 'Light Effect 5', 'Light Effect 6'])
  })

  it('has no device picker with one device', () => {
    setup()
    expect(screen.queryByLabelText('Device whose lights to show')).toBeNull()
  })

  it('with two devices shows the first device\'s lights, and the other\'s after switching', () => {
    const two = [{ id: 'd1', nickname: 'Stage' }, { id: 'd2', nickname: 'Bar' }]
    const props = setup({ devices: two })

    expect(screen.getByLabelText('Light for the $5 button')).toHaveValue('effect1') // Stage
    fireEvent.change(screen.getByLabelText('Device whose lights to show'), { target: { value: 'd2' } })
    expect(screen.getByLabelText('Light for the $5 button')).toHaveValue('effect6') // Bar
    fireEvent.change(screen.getByLabelText('Light for the $5 button'), { target: { value: 'effect2' } })
    expect(props.onLightChange).toHaveBeenCalledWith('d2', 5, 'effect2')
  })

  it('says to add a device when there is none, and still lets the amounts be changed', () => {
    setup({ devices: [] })
    expect(screen.getAllByText('Add a device to choose lights')).toHaveLength(6)
    expect(screen.getByRole('button', { name: 'Change amounts' })).toBeInTheDocument()
  })

  it('shows the amount picker only after "Change amounts", and hides it again', () => {
    setup()
    expect(screen.queryByRole('group', { name: 'Tip amounts to offer' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Change amounts' }))
    expect(screen.getByRole('group', { name: 'Tip amounts to offer' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Done changing amounts' }))
    expect(screen.queryByRole('group', { name: 'Tip amounts to offer' })).toBeNull()
  })

  it('saves new amounts through the picker, and only six at a time', () => {
    const props = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Change amounts' }))
    fireEvent.click(screen.getByRole('button', { name: '$100' })) // off
    fireEvent.click(screen.getByRole('button', { name: '$2' }))   // on
    fireEvent.click(screen.getByRole('button', { name: 'Save amounts' }))
    expect(props.onSaveAmounts).toHaveBeenCalledWith([2, 5, 10, 15, 20, 50])
  })

  it('disables the lights while one is being saved', () => {
    setup({ busyDeviceId: 'd1' })
    expect(screen.getByLabelText('Light for the $5 button')).toBeDisabled()
    expect(screen.getByText('Saving…')).toBeInTheDocument()
  })
})
