import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { photoSrc } from '../../utils/photoUrl'
import { usePortalTheme } from '../../theme/ThemeContext'
import { ThemeToggle, ThemeQuickToggle } from '../ui/ThemeToggle'
import { UpdateBanner } from '../ui/UpdateBanner'
import { VersionLabel } from '../ui/VersionLabel'
import { BrandIcon, type BrandIconName } from '../icons/BrandIcons'

export interface PortalNavItem {
  id: string
  label: string
  icon: BrandIconName
  /** A small count shown on the item, e.g. waiting song requests */
  badge?: number
  /** Heading this item sits under in the sidebar and the phone menu. Items of one group must be next to each other. */
  group?: string
  /** On a phone, pinned items take the bottom bar; the rest go under "More". Without any pinned item, the first ones are used. */
  pin?: boolean
}

interface PortalShellProps {
  items: PortalNavItem[]
  active: string
  onSelect: (id: string) => void
  userName: string
  userPhotoUrl?: string
  onOpenProfile: () => void
  onLogout: () => void
  profileActive?: boolean
  /** Second line under the account name in the sidebar */
  accountHint?: string
  /** Shown above the page on every screen, e.g. a payout warning */
  topNotice?: ReactNode
  children: ReactNode
}

function Avatar({ name, photoUrl, size = 36 }: { name: string; photoUrl?: string; size?: number }) {
  if (photoUrl) {
    return <img src={photoSrc(photoUrl)} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(name.trim().charAt(0) || 'T').toUpperCase()}
    </span>
  )
}

function GroupLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`px-3 pb-1 text-xs font-bold uppercase tracking-wide text-ink-500 ${className}`}>{children}</p>
}

/** Splits items into runs that share a heading, keeping their order. */
export function sectionsOf(items: PortalNavItem[]): { label?: string; items: PortalNavItem[] }[] {
  const out: { label?: string; items: PortalNavItem[] }[] = []
  for (const item of items) {
    const last = out[out.length - 1]
    if (last && last.label === item.group) last.items.push(item)
    else out.push({ label: item.group, items: [item] })
  }
  return out
}

/** Most items a phone's bottom bar shows at once. With more, the first few stay and the rest go under "More". */
const BAR_LIMIT = 5

/** The portal frame: a left sidebar on desktop, a bottom bar on phones (with a "More" sheet when there are many items). */
export function PortalShell({
  items,
  active,
  onSelect,
  userName,
  userPhotoUrl,
  onOpenProfile,
  onLogout,
  profileActive = false,
  accountHint = 'Profile and payouts',
  topNotice,
  children
}: PortalShellProps) {
  const { className: themeClass, dark } = usePortalTheme()
  const logoSrc = dark ? '/images/logo/tipwave-logo-v2-light.png' : '/images/logo/tipwave-logo-v2.png'
  const [moreOpen, setMoreOpen] = useState(false)
  const overflowing = items.length > BAR_LIMIT
  const pinned = items.filter(i => i.pin).slice(0, BAR_LIMIT - 1)
  const barItems = !overflowing ? items : pinned.length > 0 ? pinned : items.slice(0, BAR_LIMIT - 1)
  const moreItems = overflowing ? items.filter(i => !barItems.includes(i)) : []
  const moreActive = !profileActive && moreItems.some(i => i.id === active)
  const moreSections = sectionsOf(moreItems)
  const moreBadge = moreItems.reduce((n, i) => n + (i.badge ?? 0), 0)

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  const choose = (id: string) => {
    setMoreOpen(false)
    onSelect(id)
  }

  return (
    <div className={`min-h-screen bg-surface ${themeClass}`}>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="px-5 pb-4 pt-5">
          <img src={logoSrc} alt="Tipwave" className="h-9 w-auto" />
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Main">
          {items.map((item, index) => {
            const on = !profileActive && item.id === active
            const startsGroup = !!item.group && item.group !== items[index - 1]?.group
            return (
              <Fragment key={item.id}>
              {startsGroup && <GroupLabel className={index === 0 ? 'pt-1' : 'pt-4'}>{item.group}</GroupLabel>}
              <button
                onClick={() => onSelect(item.id)}
                aria-current={on ? 'page' : undefined}
                className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${
                  on ? 'bg-brand-50 text-brand-800' : 'text-ink-700 hover:bg-slate-50'
                }`}
              >
                <BrandIcon name={item.icon} size={20} tone={on ? 'brand' : 'muted'} />
                <span className="flex-1 text-left">{item.label}</span>
                {!!item.badge && (
                  <span className="rounded-full bg-accent-500 px-2 py-0.5 text-xs font-bold text-white">{item.badge}</span>
                )}
              </button>
              </Fragment>
            )
          })}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <ThemeToggle className="mb-2" />
          <button
            onClick={onOpenProfile}
            aria-current={profileActive ? 'page' : undefined}
            className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors ${
              profileActive ? 'bg-brand-50' : 'hover:bg-slate-50'
            }`}
          >
            <Avatar name={userName} photoUrl={userPhotoUrl} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink-900">{userName}</span>
              <span className="block text-xs text-ink-500">{accountHint}</span>
            </span>
          </button>
          <button
            onClick={onLogout}
            className="mt-1 flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-500 hover:bg-slate-50"
          >
            <BrandIcon name="logout" size={18} tone="muted" />
            Sign out
          </button>
          <VersionLabel className="mt-1 px-3" />
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <img src={logoSrc} alt="Tipwave" className="h-8 w-auto" />
        <div className="flex items-center gap-1">
          <ThemeQuickToggle />
          <button onClick={() => setMoreOpen(true)} aria-label="Account and menu" aria-haspopup="dialog" className="rounded-full">
            <Avatar name={userName} photoUrl={userPhotoUrl} size={34} />
          </button>
        </div>
      </header>

      <main className="lg:pl-60">
        <div className="mx-auto max-w-5xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          <UpdateBanner />
          {topNotice && <div className="mb-5 empty:hidden">{topNotice}</div>}
          {children}
        </div>
      </main>

      {/* Phone bottom bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-slate-200 bg-white lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {barItems.map(item => {
          const on = !profileActive && item.id === active
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              aria-current={on ? 'page' : undefined}
              className="relative flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1"
            >
              <BrandIcon name={item.icon} size={22} tone={on ? 'brand' : 'muted'} />
              <span className={`text-[11px] font-semibold ${on ? 'text-brand-700' : 'text-ink-500'}`}>{item.label}</span>
              {!!item.badge && (
                <span className="absolute right-[calc(50%-20px)] top-2 min-w-[18px] rounded-full bg-accent-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
        {overflowing && (
          <button
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-current={moreActive ? 'page' : undefined}
            className="relative flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1"
          >
            <BrandIcon name="menu" size={22} tone={moreActive ? 'brand' : 'muted'} />
            <span className={`text-[11px] font-semibold ${moreActive ? 'text-brand-700' : 'text-ink-500'}`}>More</span>
            {moreBadge > 0 && (
              <span className="absolute right-[calc(50%-20px)] top-2 min-w-[18px] rounded-full bg-accent-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white">{moreBadge}</span>
            )}
          </button>
        )}
      </nav>

      {/* Phone "More" sheet: the rest of the menu, the account, and sign out */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="More">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setMoreOpen(false)} aria-hidden="true" />
          <div
            className={`absolute inset-x-0 bottom-0 rounded-t-3xl bg-white shadow-2xl ${themeClass}`}
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-300" />
            <div className={`max-h-[55dvh] overflow-y-auto px-4 pb-3 pt-4 ${moreItems.length === 0 ? 'hidden' : ''}`}>
              {moreSections.map((section, i) => (
                <div key={section.label ?? i} className={i > 0 ? 'pt-3' : ''}>
                  {section.label && <GroupLabel>{section.label}</GroupLabel>}
                  <div className="grid grid-cols-3 gap-2">
                    {section.items.map(item => {
                      const on = !profileActive && item.id === active
                      return (
                        <button
                          key={item.id}
                          onClick={() => choose(item.id)}
                          aria-current={on ? 'page' : undefined}
                          className={`relative flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl text-xs font-semibold ${on ? 'bg-brand-50 text-brand-800' : 'bg-slate-50 text-ink-700'}`}
                        >
                          <BrandIcon name={item.icon} size={24} tone={on ? 'brand' : 'muted'} />
                          {item.label}
                          {!!item.badge && <span className="absolute right-2 top-2 min-w-[18px] rounded-full bg-accent-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white">{item.badge}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 px-4 pt-3">
              <button
                onClick={() => {
                  setMoreOpen(false)
                  onOpenProfile()
                }}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-50"
              >
                <Avatar name={userName} photoUrl={userPhotoUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink-900">{userName}</span>
                  <span className="block text-xs text-ink-500">{accountHint}</span>
                </span>
              </button>
              <button
                onClick={() => {
                  setMoreOpen(false)
                  onLogout()
                }}
                className="mt-1 flex h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-700 hover:bg-slate-50"
              >
                <BrandIcon name="logout" size={20} tone="muted" />
                Sign out
              </button>
              <VersionLabel className="px-3 pb-1 pt-1" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
