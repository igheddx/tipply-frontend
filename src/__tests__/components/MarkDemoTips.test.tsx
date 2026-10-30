import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const post = vi.hoisted(() => vi.fn())
const confirm = vi.hoisted(() => vi.fn())
vi.mock('@/services/api', () => ({ apiService: { post } }))
vi.mock('@/components/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/ui')>()),
  useFeedback: () => ({ toast: vi.fn(), confirm })
}))

import MarkDemoTips from '@/components/MarkDemoTips'

const preview = {
  applied: false,
  hasSwitchHistory: true,
  tipsToMark: 12,
  amountToMark: 340,
  alreadyDemo: 3,
  keptRealStampedTest: 40,
  conflictsLeftReal: 0,
  tipsMarked: 0,
  windows: [
    { mode: 'test', from: undefined, to: '2026-03-01T12:00:00Z', tips: 12, amount: 340 },
    { mode: 'live', from: '2026-03-01T12:00:00Z', to: undefined, tips: 80, amount: 2100 }
  ]
}

describe('MarkDemoTips', () => {
  beforeEach(() => {
    post.mockReset()
    confirm.mockReset().mockResolvedValue(true)
  })

  it('checking only previews: it asks the server not to apply', async () => {
    post.mockResolvedValue({ data: preview })
    render(<MarkDemoTips />)
    fireEvent.click(screen.getByRole('button', { name: /check past tips/i }))

    expect(await screen.findByText(/12 past tips \(\$340\.00\) were taken in test mode/i)).toBeInTheDocument()
    expect(post).toHaveBeenCalledWith('/api/admin/mark-demo-tips', { apply: false })
    expect(screen.getByText(/40 older tips carry a “test” label/i)).toBeInTheDocument()
  })

  it('asks first, and only then applies', async () => {
    post.mockResolvedValueOnce({ data: preview }).mockResolvedValueOnce({ data: { ...preview, applied: true, tipsMarked: 12 } })
    render(<MarkDemoTips />)
    fireEvent.click(screen.getByRole('button', { name: /check past tips/i }))
    fireEvent.click(await screen.findByRole('button', { name: /mark 12 as demo/i }))

    await waitFor(() => expect(post).toHaveBeenLastCalledWith('/api/admin/mark-demo-tips', { apply: true }))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/marked 12 tips as demo/i)).toBeInTheDocument()
  })

  it('does not apply when the confirmation is declined', async () => {
    confirm.mockResolvedValue(false)
    post.mockResolvedValue({ data: preview })
    render(<MarkDemoTips />)
    fireEvent.click(screen.getByRole('button', { name: /check past tips/i }))
    fireEvent.click(await screen.findByRole('button', { name: /mark 12 as demo/i }))

    await waitFor(() => expect(confirm).toHaveBeenCalled())
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('says nothing can be marked when there is no switch history', async () => {
    post.mockResolvedValue({ data: { ...preview, hasSwitchHistory: false, tipsToMark: 0, windows: [] } })
    render(<MarkDemoTips />)
    fireEvent.click(screen.getByRole('button', { name: /check past tips/i }))
    expect(await screen.findByText(/no test\/live switch history found/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark .* as demo/i })).not.toBeInTheDocument()
  })
})
