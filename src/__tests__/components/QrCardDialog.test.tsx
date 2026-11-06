import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QrCardDialog } from '@/components/QrCardDialog'

const qr = vi.hoisted(() => ({ fetchQrPng: vi.fn() }))
vi.mock('@/utils/qrImage', () => qr)
const card = vi.hoisted(() => ({ renderQrCard: vi.fn(), cardToPng: vi.fn() }))
vi.mock('@/utils/qrCard', async () => ({
  ...(await vi.importActual<any>('@/utils/qrCard')),
  renderQrCard: card.renderQrCard,
  cardToPng: card.cardToPng
}))

const renderDialog = (props: Partial<React.ComponentProps<typeof QrCardDialog>> = {}) =>
  render(<QrCardDialog open onClose={() => {}} title="Main stage QR card" deviceId="d1" name="Rockin J PianoBar" fileLabel="venue-Main-stage" {...props} />)

describe('QR card dialog', () => {
  beforeEach(() => {
    qr.fetchQrPng.mockReset().mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
    card.renderQrCard.mockReset().mockResolvedValue({})
    card.cardToPng.mockReset().mockResolvedValue(new Blob(['card'], { type: 'image/png' }))
    ;(globalThis as any).createImageBitmap = vi.fn(async () => ({ width: 10, height: 10 }))
    ;(URL as any).createObjectURL = vi.fn(() => 'blob:preview')
    ;(URL as any).revokeObjectURL = vi.fn()
  })

  it('makes the 4 x 6 card as a preview, with the name given', async () => {
    renderDialog()
    expect(await screen.findByAltText('QR card for Main stage QR card')).toHaveAttribute('src', 'blob:preview')
    expect(qr.fetchQrPng).toHaveBeenCalledWith('d1', undefined)
    expect(card.renderQrCard).toHaveBeenCalledWith(expect.anything(), 'Rockin J PianoBar', 'card')
  })

  it('asks for a performer\'s own code when given a performer', async () => {
    renderDialog({ performerId: 'p1', name: 'Annie' })
    await screen.findByAltText(/QR card/)
    expect(qr.fetchQrPng).toHaveBeenCalledWith('d1', 'p1')
    expect(card.renderQrCard).toHaveBeenCalledWith(expect.anything(), 'Annie', 'card')
  })

  it('offers both print sizes and renders the large one on demand', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    renderDialog()
    await screen.findByAltText(/QR card/)
    expect(screen.getByRole('button', { name: 'Download 4 × 6 in' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Download 8.5 × 11 in' }))

    await waitFor(() => expect(card.renderQrCard).toHaveBeenCalledWith(expect.anything(), 'Rockin J PianoBar', 'letter'))
    await waitFor(() => expect(click).toHaveBeenCalled())
    click.mockRestore()
  })

  it('keeps the downloads off until the card is ready, and says so when it cannot be made', async () => {
    qr.fetchQrPng.mockRejectedValue(new Error('nope'))
    renderDialog()
    expect(screen.getByRole('button', { name: 'Download 4 × 6 in' })).toBeDisabled()
    expect(await screen.findByText(/could not be made/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download 8.5 × 11 in' })).toBeDisabled()
  })

  it('frees the preview when closed', async () => {
    const { unmount } = renderDialog()
    await screen.findByAltText(/QR card/)
    unmount()
    expect((URL as any).revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })
})
