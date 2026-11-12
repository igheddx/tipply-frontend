import React from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import SongRequestMonitor from '../components/SongRequestMonitor'

/**
 * An admin watching a performer's Live screen (opened from Admin → Insights). It is the performer's own Live screen with every
 * button that changes something taken away. It needs an admin sign-in, so a copied link does nothing for anyone else.
 */
const AdminWatchLivePage: React.FC = () => {
  const { profileId } = useParams<{ profileId: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  // Only a label: the screen is chosen by the id, and the name is shown as plain text
  const name = (params.get('n') || '').slice(0, 80)

  if (!profileId) return null

  return (
    <SongRequestMonitor
      profileId={profileId}
      isVisible
      readOnly
      watchingLabel={name ? `Watching ${name}` : 'Watching a performer'}
      onClose={() => {
        window.close() // works when it was opened from Insights in its own tab
        navigate('/admin')
      }}
    />
  )
}

export default AdminWatchLivePage
