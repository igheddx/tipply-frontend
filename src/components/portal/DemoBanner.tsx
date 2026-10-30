import { Banner } from '../ui'
import { Switch } from '../ui/Switch'

interface DemoBannerProps {
  /** Production is taking fake money right now */
  demoMode: boolean
  /** The performer is looking at demo data instead of real tips */
  showDemo: boolean
  onToggle: () => void
}

/** Shown on the performer's main screen only while production is in demo mode. */
export function DemoBanner({ demoMode, showDemo, onToggle }: DemoBannerProps) {
  if (!demoMode) return null
  return (
    <Banner
      tone="warning"
      title={showDemo ? 'Showing demo data' : 'Demo mode is on'}
      className="mb-5"
      action={<Switch checked={showDemo} label="Show demo data" onChange={onToggle} />}
    >
      {showDemo
        ? 'These are demo tips paid with test money. No real money moved. Turn this off to go back to your real tips.'
        : 'Payments are using test money right now, so tips taken are marked as demo and kept out of your real totals. Turn on “Show demo data” to see them.'}
    </Banner>
  )
}
