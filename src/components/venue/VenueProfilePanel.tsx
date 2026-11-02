import { useEffect, useState } from 'react'
import { Banner, Button, Card } from '../ui'
import { useFeedback } from '../ui/Feedback'
import { venueApi, type VenueProfile } from '../../services/venueApi'

const field = 'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500'

/** The venue's details, and the one-tap way to record where the venue is (used to check performers are really there). */
export function VenueProfilePanel({ venue, onSaved }: { venue: VenueProfile; onSaved: () => void }) {
  const { toast } = useFeedback()
  const [form, setForm] = useState({
    businessName: '', firstName: '', lastName: '', phone: '', addressLine1: '', city: '', state: '', postalCode: ''
  })
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    setForm({
      businessName: venue.businessName ?? '',
      firstName: venue.firstName,
      lastName: venue.lastName,
      phone: venue.phone ?? '',
      addressLine1: venue.addressLine1 ?? '',
      city: venue.city ?? '',
      state: venue.state ?? '',
      postalCode: venue.postalCode ?? ''
    })
  }, [venue])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  const save = async () => {
    setSaving(true)
    const res = await venueApi.updateMe(form)
    setSaving(false)
    if (res.error) toast(res.error, 'error')
    else {
      toast('Saved', 'success')
      onSaved()
    }
  }

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      toast('This browser cannot share its location.', 'error')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const res = await venueApi.updateMe({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        setLocating(false)
        if (res.error) toast(res.error, 'error')
        else {
          toast('Venue location saved', 'success')
          onSaved()
        }
      },
      () => {
        setLocating(false)
        toast('We could not get your location. Allow location for this site and try again.', 'error')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  return (
    <div className="space-y-5">
      <Card
        title="Where your venue is"
        subtitle="Performers you trust can start a session by themselves only when their phone shows they are here."
      >
        {venue.hasLocation ? (
          <Banner tone="success" title="Location saved">
            If you move devices to another room or building, tap the button again while you are there.
          </Banner>
        ) : (
          <Banner tone="warning" title="No location yet">
            Open this page on a phone or tablet at your venue and tap the button. Until then every session needs your approval.
          </Banner>
        )}
        <div className="mt-4">
          <Button variant="secondary" loading={locating} onClick={useMyLocation}>
            {venue.hasLocation ? 'Update to my current location' : 'Use my current location'}
          </Button>
        </div>
      </Card>

      <Card title="Venue details">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="p-biz" className="mb-1.5 block text-sm font-semibold text-ink-700">Business name</label>
            <input id="p-biz" className={field} value={form.businessName} onChange={set('businessName')} />
          </div>
          <div>
            <label htmlFor="p-first" className="mb-1.5 block text-sm font-semibold text-ink-700">Contact first name</label>
            <input id="p-first" className={field} value={form.firstName} onChange={set('firstName')} />
          </div>
          <div>
            <label htmlFor="p-last" className="mb-1.5 block text-sm font-semibold text-ink-700">Contact last name</label>
            <input id="p-last" className={field} value={form.lastName} onChange={set('lastName')} />
          </div>
          <div>
            <label htmlFor="p-phone" className="mb-1.5 block text-sm font-semibold text-ink-700">Phone</label>
            <input id="p-phone" type="tel" className={field} value={form.phone} onChange={set('phone')} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink-700" htmlFor="p-email">Email</label>
            <input id="p-email" className={`${field} bg-slate-50`} value={venue.email} readOnly />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="p-addr" className="mb-1.5 block text-sm font-semibold text-ink-700">Street address</label>
            <input id="p-addr" className={field} value={form.addressLine1} onChange={set('addressLine1')} />
          </div>
          <div>
            <label htmlFor="p-city" className="mb-1.5 block text-sm font-semibold text-ink-700">City</label>
            <input id="p-city" className={field} value={form.city} onChange={set('city')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="p-state" className="mb-1.5 block text-sm font-semibold text-ink-700">State</label>
              <input id="p-state" className={field} value={form.state} onChange={set('state')} />
            </div>
            <div>
              <label htmlFor="p-zip" className="mb-1.5 block text-sm font-semibold text-ink-700">Zip</label>
              <input id="p-zip" className={field} value={form.postalCode} onChange={set('postalCode')} />
            </div>
          </div>
        </div>
        <div className="mt-5">
          <Button loading={saving} onClick={save}>
            Save changes
          </Button>
        </div>
      </Card>
    </div>
  )
}
