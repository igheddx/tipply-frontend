import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import DeviceWifiSetup from '@/pages/DeviceWifiSetup'

const vault = vi.hoisted(() => ({
  list: vi.fn(),
  save: vi.fn(),
  forget: vi.fn()
}))
vi.mock('@/utils/savedWifi', () => ({ wifiVault: vault }))

// A fake Tipwave device. `events` records the order of what the page does so the tests can check it.
const makeDevice = () => {
  const events: string[] = []
  let onStatus: ((e: any) => void) | undefined
  const status = {
    addEventListener: (_: string, fn: any) => { onStatus = fn; events.push('listen') },
    removeEventListener: () => { onStatus = undefined },
    startNotifications: async () => { events.push('notify') },
    stopNotifications: async () => {}
  }
  const writer = (name: string) => ({ writeValueWithResponse: async () => { events.push(`write:${name}`) } })
  const chars: Record<string, any> = {
    '550e8400-e29b-41d4-a716-446655440001': writer('ssid'),
    '550e8400-e29b-41d4-a716-446655440002': writer('password'),
    '550e8400-e29b-41d4-a716-446655440003': status
  }
  const device = {
    name: 'Tipwave-TPW-TEST',
    id: 'dev-1',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    gatt: {
      connected: true,
      connect: async () => ({ getPrimaryService: async () => ({ getCharacteristic: async (id: string) => chars[id] }) }),
      disconnect: vi.fn()
    }
  }
  const emit = (payload: object) => onStatus?.({ target: { value: new TextEncoder().encode(JSON.stringify(payload)) } })
  return { device, events, emit }
}

async function reachWifiStep(fake: ReturnType<typeof makeDevice>) {
  ;(navigator as any).bluetooth = { requestDevice: vi.fn().mockResolvedValue(fake.device) }
  render(<DeviceWifiSetup />)
  fireEvent.click(await screen.findByRole('button', { name: /find my device/i }))
  await screen.findByLabelText(/network name/i)
}

describe('DeviceWifiSetup', () => {
  beforeEach(() => {
    vault.list.mockReset().mockResolvedValue([])
    vault.save.mockReset().mockResolvedValue(true)
    vault.forget.mockReset()
  })

  it('listens for the device answer before sending the Wi-Fi details', async () => {
    const fake = makeDevice()
    await reachWifiStep(fake)
    fireEvent.change(screen.getByLabelText(/network name/i), { target: { value: 'Flying J' } })
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'piano-bar-1' } })
    fireEvent.click(screen.getByRole('button', { name: /connect to wi-fi/i }))

    await waitFor(() => expect(fake.events).toContain('write:password'))
    expect(fake.events).toEqual(['listen', 'notify', 'write:ssid', 'write:password'])
  })

  it('shows the finished screen with timings and saves the network after success', async () => {
    const fake = makeDevice()
    await reachWifiStep(fake)
    fireEvent.change(screen.getByLabelText(/network name/i), { target: { value: 'Flying J' } })
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'piano-bar-1' } })
    fireEvent.click(screen.getByRole('button', { name: /connect to wi-fi/i }))
    await waitFor(() => expect(fake.events).toContain('write:password'))

    fake.emit({ state: 'success', ip: '10.0.0.5' })

    await screen.findByText(/your device is online/i)
    expect(screen.getByText(/where the time went/i)).toBeInTheDocument()
    expect(vault.save).toHaveBeenCalledWith('Flying J', 'piano-bar-1')
  })

  it('does not save the network when the box is unticked', async () => {
    const fake = makeDevice()
    await reachWifiStep(fake)
    fireEvent.click(screen.getByLabelText(/remember this network/i))
    fireEvent.change(screen.getByLabelText(/network name/i), { target: { value: 'Flying J' } })
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'piano-bar-1' } })
    fireEvent.click(screen.getByRole('button', { name: /connect to wi-fi/i }))
    await waitFor(() => expect(fake.events).toContain('write:password'))
    fake.emit({ state: 'success' })
    await screen.findByText(/your device is online/i)
    expect(vault.save).not.toHaveBeenCalled()
  })

  it('stops waiting and says why when the device reports a wrong password', async () => {
    const fake = makeDevice()
    await reachWifiStep(fake)
    fireEvent.change(screen.getByLabelText(/network name/i), { target: { value: 'Flying J' } })
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /connect to wi-fi/i }))
    await waitFor(() => expect(fake.events).toContain('write:password'))

    fake.emit({ state: 'connecting' })
    fake.emit({ state: 'failure', error: 'auth_failed' })

    expect(await screen.findByText(/wrong wifi password/i)).toBeInTheDocument()
    // The button is usable again for a retry, and nothing was saved
    await waitFor(() => expect(screen.getByRole('button', { name: /connect to wi-fi/i })).not.toBeDisabled())
    expect(vault.save).not.toHaveBeenCalled()
  })

  it('fills the name and password from a saved network', async () => {
    vault.list.mockResolvedValue([{ ssid: 'Flying J', password: 'piano-bar-1', lastUsed: 2 }, { ssid: 'Home', password: 'h', lastUsed: 1 }])
    await reachWifiStep(makeDevice())

    fireEvent.change(await screen.findByLabelText(/saved networks/i), { target: { value: 'Flying J' } })

    expect(screen.getByLabelText(/network name/i)).toHaveValue('Flying J')
    expect(screen.getByLabelText(/^password/i)).toHaveValue('piano-bar-1')
    expect(screen.getByRole('button', { name: /connect to wi-fi/i })).not.toBeDisabled()
  })

  it('forgets a saved network', async () => {
    vault.list.mockResolvedValue([{ ssid: 'Flying J', password: 'piano-bar-1', lastUsed: 2 }])
    await reachWifiStep(makeDevice())
    fireEvent.change(await screen.findByLabelText(/saved networks/i), { target: { value: 'Flying J' } })
    fireEvent.click(screen.getByRole('button', { name: /forget/i }))
    expect(vault.forget).toHaveBeenCalledWith('Flying J')
    await waitFor(() => expect(screen.queryByLabelText(/saved networks/i)).not.toBeInTheDocument())
  })
})
