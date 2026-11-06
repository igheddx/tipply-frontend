import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { VenueDevices } from '@/components/venue/VenueDevices'

vi.mock('@/services/api', () => ({ default: { addDevice: vi.fn(), updateDevicePause: vi.fn(), updateDeviceConfiguration: vi.fn() } }))
vi.mock('@/services/venueApi', () => ({ venueApi: { startForPerformer: vi.fn(), end: vi.fn() } }))
vi.mock('@/components/QrCardDialog', () => ({ QrCardDialog: (p: any) => p.open ? <div role="dialog" aria-label="qr card">{`name=${p.name};performer=${p.performerId ?? 'none'};device=${p.deviceId}`}</div> : null }))
vi.mock('@/components/ui/Feedback', () => ({ useFeedback: () => ({ toast: vi.fn(), confirm: vi.fn(async () => true) }), FeedbackProvider: ({ children }: any) => children }))

const venue = { id: 'v1', status: 'approved', timeZoneId: 'America/Chicago' } as any
const device = { deviceId: 'd1', name: 'Main stage', serialNumber: 'TPY-1', isPaused: false, isSoundEnabled: false, soundId: 1, soundVolume: 'low', isRandomLightEffect: false, current: null, pendingRequests: 0, upcomingSessions: 0 } as any

describe('venue device QR card', () => {
  it('is the venue\'s own card: the venue\'s name, no performer, for that device', () => {
    render(<VenueDevices venue={{ ...venue, businessName: 'Rockin J PianoBar' }} devices={[device]} links={[]} onChanged={() => {}} />)
    expect(screen.queryByRole('dialog', { name: 'qr card' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'QR code' }))
    expect(screen.getByRole('dialog', { name: 'qr card' })).toHaveTextContent('name=Rockin J PianoBar;performer=none;device=d1')
  })
})
