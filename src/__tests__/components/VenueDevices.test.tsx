import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { VenueDevices } from '@/components/venue/VenueDevices'

vi.mock('@/services/api', () => ({ default: { addDevice: vi.fn(), updateDevicePause: vi.fn(), updateDeviceConfiguration: vi.fn() } }))
vi.mock('@/services/venueApi', () => ({ venueApi: { startForPerformer: vi.fn(), end: vi.fn() } }))
const qr = vi.hoisted(() => ({ fetchQrPng: vi.fn() }))
vi.mock('@/utils/qrImage', () => qr)
vi.mock('@/components/ui/Feedback', () => ({ useFeedback: () => ({ toast: vi.fn(), confirm: vi.fn(async () => true) }), FeedbackProvider: ({ children }: any) => children }))

const venue = { id: 'v1', status: 'approved', timeZoneId: 'America/Chicago' } as any
const device = { deviceId: 'd1', name: 'Main stage', serialNumber: 'TPY-1', isPaused: false, isSoundEnabled: false, soundId: 1, soundVolume: 'low', isRandomLightEffect: false, current: null, pendingRequests: 0, upcomingSessions: 0 } as any

describe('venue device QR code', () => {
  beforeEach(() => {
    qr.fetchQrPng.mockReset()
    ;(URL as any).createObjectURL = vi.fn(() => 'blob:qr-1')
    ;(URL as any).revokeObjectURL = vi.fn()
  })

  it('loads the picture and shows it with a download link', async () => {
    qr.fetchQrPng.mockResolvedValue(new Blob(['x'], { type: 'image/png' }))
    render(<VenueDevices venue={venue} devices={[device]} links={[]} onChanged={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'QR code' }))

    expect(await screen.findByAltText('QR code for Main stage')).toHaveAttribute('src', 'blob:qr-1')
    expect(qr.fetchQrPng).toHaveBeenCalledWith('d1')
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', 'blob:qr-1')
    expect(screen.getByText(/always works/)).toBeInTheDocument()
  })

  it('says so when the picture cannot be loaded, instead of showing nothing', async () => {
    qr.fetchQrPng.mockRejectedValue(new Error('nope'))
    render(<VenueDevices venue={venue} devices={[device]} links={[]} onChanged={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'QR code' }))

    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Download' })).toBeNull()
  })

  it('frees the picture when the dialog is closed', async () => {
    qr.fetchQrPng.mockResolvedValue(new Blob(['x'], { type: 'image/png' }))
    render(<VenueDevices venue={venue} devices={[device]} links={[]} onChanged={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'QR code' }))
    await screen.findByAltText('QR code for Main stage')
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect((URL as any).revokeObjectURL).toHaveBeenCalledWith('blob:qr-1'))
  })
})
