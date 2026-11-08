import { useState } from 'react'
import { Tabs } from '../ui'
import PerformerSongRequests from '../PerformerSongRequests'
import { AdminPerformerShows } from './AdminPerformerShows'

/** What opens under a performer in the admin table: their shows (the live view) or their song requests by calendar day. */
export function AdminPerformerPanel({ profileId }: { profileId: string }) {
  const [view, setView] = useState<'shows' | 'day'>('shows')
  return (
    <div className="space-y-4">
      <Tabs
        active={view}
        onChange={id => setView(id as 'shows' | 'day')}
        items={[
          { id: 'shows', label: 'Shows' },
          { id: 'day', label: 'By day' }
        ]}
      />
      {view === 'shows' ? <AdminPerformerShows profileId={profileId} /> : <PerformerSongRequests profileId={profileId} />}
    </div>
  )
}
