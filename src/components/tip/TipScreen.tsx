import { BrandIcon } from '../icons/BrandIcons'
import { photoSrc } from '../../utils/photoUrl'

/** Gradient behind each of the six amounts, in order. They match the light colors the device shows. */
const AMOUNT_STYLES: { background: string; color: string }[] = [
  { background: 'linear-gradient(135deg,#2dd4bf,#0f8f86)', color: '#FFFFFF' },
  { background: 'linear-gradient(135deg,#22b8d6,#0e7490)', color: '#FFFFFF' },
  { background: 'linear-gradient(135deg,#5b9bf8,#2748b8)', color: '#FFFFFF' },
  { background: 'linear-gradient(135deg,#f472b6,#c92a70)', color: '#FFFFFF' },
  { background: 'linear-gradient(135deg,#fb7185,#d92d4b)', color: '#FFFFFF' },
  // dark text: white on yellow is hard to read
  { background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#3B2300' }
]

const CARD_BRANDS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  discover: 'Discover',
  diners: 'Diners',
  jcb: 'JCB',
  unionpay: 'UnionPay'
}

export function formatMoney(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`
}

export function cardLabel(card: { brand?: string; last4?: string } | null): string {
  if (!card?.last4) return 'Card on file'
  const brand = card.brand ? CARD_BRANDS[card.brand.toLowerCase()] ?? '' : ''
  return `${brand ? `${brand} ` : ''}••${card.last4}`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || 'T'
}

export interface TipScreenProps {
  performerName: string
  photoUrl?: string
  bio?: string
  amounts: number[]
  /** False until the performer and the tipper's ID have loaded: shows placeholders and ignores taps */
  ready: boolean
  /** The amount tapped most recently, shown as "Sent" for a moment */
  sentAmount: number | null
  onTip: (amount: number) => void
  canRequestSong: boolean
  selectedSong: { title: string; artist: string } | null
  /** The song that was just sent with a tip, shown for a few seconds as "Request sent" */
  sentSong?: { title: string; artist: string } | null
  onOpenSongPicker: () => void
  onClearSong: () => void
  card: { brand?: string; last4?: string } | null
  onChangeCard: () => void
  /** What this tipper has given in the last 24 hours */
  total: number
}

/**
 * The tip page. Everything fits on one screen with no scrolling: the six amounts take whatever height is left
 * after the header, the song row and the bottom bar, so they shrink on short phones instead of being cut off.
 */
export function TipScreen({
  performerName,
  photoUrl,
  bio,
  amounts,
  ready,
  sentAmount,
  onTip,
  canRequestSong,
  selectedSong,
  sentSong = null,
  onOpenSongPicker,
  onClearSong,
  card,
  onChangeCard,
  total
}: TipScreenProps) {
  return (
    <div
      className="fixed inset-0 flex flex-col gap-2.5 overflow-hidden px-4 text-white"
      style={{
        height: '100dvh',
        paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)',
        background:
          'radial-gradient(60% 40% at 90% 0%, rgba(6,182,200,0.28), transparent 70%),' +
          'radial-gradient(60% 40% at 0% 100%, rgba(229,84,140,0.22), transparent 70%),' +
          'linear-gradient(160deg,#0a2533,#0d4254 55%,#0f3447)'
      }}
    >
      <header className="flex flex-none items-center gap-3">
        {photoUrl ? (
          <img src={photoSrc(photoUrl)} alt="" className="h-10 w-10 flex-none rounded-full border-2 border-white/30 object-cover" />
        ) : (
          <div
            aria-hidden
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-extrabold"
            style={{ background: performerName ? 'linear-gradient(135deg,#06b6c8,#e5548c)' : 'rgba(255,255,255,0.15)' }}
          >
            {performerName ? initials(performerName) : ''}
          </div>
        )}
        <div className="min-w-0">
          {performerName ? (
            <h1 className="truncate text-lg font-extrabold leading-tight">Tip {performerName}</h1>
          ) : (
            <div aria-hidden className="h-5 w-40 animate-pulse rounded bg-white/20" />
          )}
          {bio && <p className="truncate text-xs text-white/70 [@media(max-height:640px)]:hidden">{bio}</p>}
        </div>
      </header>

      {/* The song request lives right under the performer, so it reads top to bottom: song first, then an amount */}
      {sentSong ? (
        <div
          role="status"
          className="flex flex-none items-center gap-3 rounded-[16px] border px-3.5 py-2.5"
          style={{ background: 'rgba(34,197,94,0.22)', borderColor: 'rgba(74,222,128,0.6)' }}
        >
          <BrandIcon name="check-circle" size={26} color="#86EFAC" />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-[13px] font-extrabold">Request sent</span>
            <span className="truncate text-[12px] text-white/80">
              {sentSong.title} · {sentSong.artist}
            </span>
          </span>
        </div>
      ) : selectedSong ? (
        <div
          className="flex-none rounded-[16px] border px-3.5 py-2.5"
          style={{ background: 'rgba(6,182,200,0.2)', borderColor: 'rgba(6,182,200,0.6)' }}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white/15">
              <BrandIcon name="music" size={20} tone="inverse" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">Your request</span>
              <span className="truncate text-[14px] font-extrabold">{selectedSong.title}</span>
              <span className="truncate text-[12px] text-white/70">{selectedSong.artist}</span>
            </span>
            <button type="button" onClick={onOpenSongPicker} className="flex-none px-1 text-[12px] font-semibold text-white/85 underline">
              Change
            </button>
            <button type="button" onClick={onClearSong} aria-label="Remove song request" className="flex h-8 w-8 flex-none items-center justify-center rounded-full active:bg-white/10">
              <BrandIcon name="close" size={16} tone="inverse" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1.5 border-t border-white/15 pt-2 text-[13px] font-bold">
            <span className="motion-safe:animate-bounce"><BrandIcon name="chevron-down" size={18} tone="inverse" strokeWidth={2.4} /></span>
            Tap an amount to send your request
          </div>
        </div>
      ) : (
        canRequestSong && (
          <button
            type="button"
            onClick={onOpenSongPicker}
            className="flex flex-none items-center justify-center gap-2 rounded-[14px] border border-white/20 bg-white/10 text-[15px] font-bold active:bg-white/20"
            style={{ height: 'max(2.5rem, 5.4dvh)' }}
          >
            <BrandIcon name="music" size={20} tone="brand" />
            Request a song
          </button>
        )
      )}

      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-x-2.5 gap-y-[1.6dvh]">
        {amounts.map((amount, index) => {
          const style = AMOUNT_STYLES[index % AMOUNT_STYLES.length]
          const sent = sentAmount === amount
          return (
            <button
              key={`${amount}-${index}`}
              type="button"
              disabled={!ready}
              onClick={() => onTip(amount)}
              aria-label={`Tip ${formatMoney(amount)}`}
              className={`relative flex min-h-0 flex-col items-center justify-center overflow-hidden rounded-[18px] border border-white/25 font-black shadow-[0_8px_20px_rgba(0,0,0,0.25)] transition-transform duration-150 active:scale-95 ${
                ready ? '' : 'animate-pulse'
              } ${selectedSong && ready ? 'tile-hint' : ''}`}
              style={{
                ...(ready ? style : { background: 'rgba(255,255,255,0.12)', color: 'transparent' }),
                fontSize: 'clamp(1.6rem, 7dvh, 2.75rem)'
              }}
            >
              {sent ? (
                <span className="flex flex-col items-center gap-0.5" style={{ fontSize: '1rem' }}>
                  <BrandIcon name="check" size={34} tone="inverse" strokeWidth={2.6} color={style.color} />
                  <span className="text-xs font-bold uppercase tracking-wider">{sentSong ? 'Request sent' : 'Sent'}</span>
                </span>
              ) : (
                <>
                  {formatMoney(amount)}
                  {selectedSong && ready && (
                    <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wider opacity-85" style={{ fontSize: 'clamp(0.6rem, 1.6dvh, 0.75rem)' }}>
                      Send request
                    </span>
                  )}
                </>
              )}
            </button>
          )
        })}
      </div>

      <div
        className="flex flex-none items-center justify-between rounded-[14px] border border-white/10 px-3.5"
        style={{ height: 'max(2.5rem, 5.2dvh)', background: 'rgba(8,12,40,0.55)' }}
      >
        <button type="button" onClick={onChangeCard} className="flex items-center gap-2 whitespace-nowrap text-xs text-indigo-200">
          <BrandIcon name="card" size={18} tone="brand" />
          <span>
            {cardLabel(card)} · <u>Change</u>
          </span>
        </button>
        <span className="flex items-baseline gap-2 whitespace-nowrap" aria-live="polite">
          <span className="text-[11px] uppercase tracking-wider text-white/70">Today</span>
          <b className="text-[19px] font-black">{formatMoney(total)}</b>
        </span>
      </div>

      <footer className="flex h-6 flex-none items-center justify-center">
        <img src="/images/logo/tipwave-logo-v2-light.png" alt="Tipwave" className="h-[22px] opacity-90" />
      </footer>
    </div>
  )
}
