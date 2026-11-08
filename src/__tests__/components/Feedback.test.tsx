import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { FeedbackBar } from '@/components/tip/FeedbackBar'
import { FeedbackFormModal } from '@/components/tip/FeedbackFormModal'
import { GiveFeedbackLink } from '@/components/tip/GiveFeedbackLink'
import { AdminFeedback } from '@/components/feedback/AdminFeedback'

const api = vi.hoisted(() => ({ submitLink: vi.fn(), adminSettings: vi.fn(), adminSetSettings: vi.fn(), adminSummary: vi.fn(), adminComments: vi.fn() }))
vi.mock('@/services/feedbackApi', () => ({ feedbackApi: api }))
const feedback = vi.hoisted(() => ({ toast: vi.fn(), confirm: vi.fn(async () => true) }))
vi.mock('@/components/ui/Feedback', () => ({ useFeedback: () => feedback, FeedbackProvider: ({ children }: any) => children }))

const stars = { promptId: 'p1', question: 'ease', kind: 'stars', text: 'How easy was that?', options: [], lowScoreMax: 3, reasons: [], textPlaceholder: '' } as any
const song = { ...stars, promptId: 'p2', question: 'song_found', kind: 'choice', text: 'Did you find the song you wanted?', options: [{ key: 'yes', label: 'Yes' }, { key: 'kind_of', label: 'Sort of' }, { key: 'no', label: 'No' }] }

beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset())
  feedback.toast.mockClear()
})

describe('FeedbackBar', () => {
  it('shows five stars, and tapping one rates', () => {
    const onRate = vi.fn()
    render(<FeedbackBar prompt={stars} phase="asking" onRate={onRate} onChoose={() => {}} onDismiss={() => {}} />)

    expect(screen.getByText('How easy was that?')).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    fireEvent.click(screen.getByRole('radio', { name: '4 out of 5' }))
    expect(onRate).toHaveBeenCalledWith(4)
  })

  it('shows Yes, Sort of and No for the song question', () => {
    const onChoose = vi.fn()
    render(<FeedbackBar prompt={song} phase="asking" onRate={() => {}} onChoose={onChoose} onDismiss={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sort of' }))
    expect(onChoose).toHaveBeenCalledWith('kind_of')
  })

  it('has a Not now that closes it', () => {
    const onDismiss = vi.fn()
    render(<FeedbackBar prompt={stars} phase="asking" onRate={() => {}} onChoose={() => {}} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('says thank you after an answer', () => {
    render(<FeedbackBar prompt={stars} phase="thanks" onRate={() => {}} onChoose={() => {}} onDismiss={() => {}} />)
    expect(screen.getByText('Thank you!')).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })
})

describe('FeedbackFormModal', () => {
  const reasons = [{ key: 'payment_setup', label: 'Setting up my card' }, { key: 'other', label: 'Something else' }]

  it('a follow-up offers the reasons and sends the one picked with the words', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<FeedbackFormModal open title="Sorry about that" reasons={reasons} alreadyLow placeholder="Tell us" skipLabel="Skip" onSend={onSend} onClose={() => {}} />)

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Setting up my card' }))
    fireEvent.change(screen.getByLabelText('Your feedback'), { target: { value: 'Card form was slow' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ choice: 'payment_setup', comment: 'Card form was slow' }))
  })

  it('can be skipped', () => {
    const onClose = vi.fn()
    render(<FeedbackFormModal open title="Sorry" reasons={reasons} alreadyLow placeholder="Tell us" skipLabel="Skip" onSend={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('the stars form asks for the reason only after a low rating', () => {
    render(<FeedbackFormModal open title="How is it?" askStars reasons={reasons} placeholder="Tell us" onSend={vi.fn()} onClose={() => {}} />)

    expect(screen.queryByText('What was it about?')).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: '5 out of 5' }))
    expect(screen.queryByText('What was it about?')).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: '2 out of 5' }))
    expect(screen.getByText('What was it about?')).toBeInTheDocument()
  })

  it('shows the server’s reason when sending fails, and keeps what was typed', async () => {
    const onSend = vi.fn().mockResolvedValue({ ok: false, error: 'Thank you. We have your feedback for today.' })
    render(<FeedbackFormModal open title="How is it?" askStars reasons={reasons} placeholder="Tell us" onSend={onSend} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText('Your feedback'), { target: { value: 'Nice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('We have your feedback for today')
    expect(screen.getByLabelText('Your feedback')).toHaveValue('Nice')
  })
})

describe('GiveFeedbackLink', () => {
  it('is available without having tipped, and sends the rating and words', async () => {
    api.submitLink.mockResolvedValue({ ok: true })
    render(<GiveFeedbackLink userId="u1" deviceUuid="dev-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Give feedback' }))
    fireEvent.click(screen.getByRole('radio', { name: '4 out of 5' }))
    fireEvent.change(screen.getByLabelText('Your feedback'), { target: { value: 'Easy' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }))

    await waitFor(() => expect(api.submitLink).toHaveBeenCalledWith({ userId: 'u1', deviceUuid: 'dev-1', rating: 4, comment: 'Easy' }))
    expect(await screen.findByText('Thank you!')).toBeInTheDocument()
  })

  it('renders nothing until the visitor has an id', () => {
    const { container } = render(<GiveFeedbackLink userId="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('will not send an empty form', () => {
    render(<GiveFeedbackLink userId="u1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Give feedback' }))
    expect(screen.getByRole('button', { name: 'Send feedback' })).toBeDisabled()
  })
})

describe('AdminFeedback', () => {
  const summary = {
    days: 30,
    questions: [{ question: 'ease', shown: 10, answered: 6, dismissed: 3 }],
    ratingCounts: [0, 1, 0, 2, 3],
    averageRating: 4.17,
    songChoices: { yes: 2, no: 1 },
    reasons: { finding_song: 1 },
    linkEntries: 2
  }

  beforeEach(() => {
    api.adminSettings.mockResolvedValue({ data: { mode: 'normal', ratePercent: 20, cooldownDays: 30 } })
    api.adminSummary.mockResolvedValue({ data: summary })
    api.adminComments.mockResolvedValue({ data: { comments: [{ id: 'c1', createdAt: '2026-11-08T01:00:00Z', question: 'general', source: 'link', rating: 2, choice: 'finding_song', comment: 'Could not find Free Bird', deviceName: 'Tip Jar', performerName: 'Dave Lovett Piano' }] } })
  })

  it('shows the stars, how often people answer or close it, and the reasons', async () => {
    render(<AdminFeedback />)

    expect(await screen.findByText(/Average 4\.2 of 5 from 6 people/)).toBeInTheDocument()
    expect(screen.getByText(/Shown 10 · Answered 6 \(60%\) · Closed 3 \(30%\)/)).toBeInTheDocument()
    expect(screen.getAllByText('Finding a song').length).toBeGreaterThan(0)
    expect(screen.getByText('Could not find Free Bird')).toBeInTheDocument()
    expect(screen.getByText(/Dave Lovett Piano \(Tip Jar\)/)).toBeInTheDocument()
  })

  it('saves new settings', async () => {
    api.adminSetSettings.mockResolvedValue({ data: { mode: 'frequent', ratePercent: 50, cooldownDays: 7 } })
    render(<AdminFeedback />)
    await screen.findByText('How often we ask')

    fireEvent.click(screen.getByRole('radio', { name: /Frequent \(testing\)/ }))
    fireEvent.change(screen.getByLabelText(/Share of tippers asked/), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText(/Days to wait/), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.adminSetSettings).toHaveBeenCalledWith({ mode: 'frequent', ratePercent: 50, cooldownDays: 7 }))
  })
})
