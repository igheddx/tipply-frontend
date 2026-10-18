import type { SVGProps } from 'react'

/**
 * Tipwave icon set. Drawn on a 24px grid with thin rounded strokes: a teal outline plus one pink detail per icon,
 * echoing the pink arc in the logo.
 *
 * Use `tone` for the color treatment:
 *   brand    teal outline with the pink detail (default)
 *   muted    single grey, for inactive or upcoming states
 *   inverse  single white, for dark or colored backgrounds
 *   current  inherits the surrounding text color
 * or pass `color` for one explicit color (status colors such as amber for a warning).
 */

type Shape = { d: string; accent?: boolean } | { cx: number; cy: number; r: number; accent?: boolean; filled?: boolean }

const SHAPES = {
  user: [
    { cx: 12, cy: 8, r: 3.6, accent: true },
    { d: 'M5.2 19.5c.6-3.5 3.4-5.5 6.8-5.5s6.2 2 6.8 5.5' }
  ],
  lock: [
    { d: 'M8 11V8a4 4 0 0 1 8 0v3', accent: true },
    { d: 'M7.5 11h9A2.5 2.5 0 0 1 19 13.5v4a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17.5v-4A2.5 2.5 0 0 1 7.5 11z' },
    { cx: 12, cy: 15.5, r: 1.1, filled: true }
  ],
  mail: [
    { d: 'M6 5.5h12A3 3 0 0 1 21 8.5v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3z' },
    { d: 'M4.2 8.6 12 13.6l7.8-5', accent: true }
  ],
  device: [
    { d: 'M8.5 9h7A4.5 4.5 0 0 1 20 13.5v1A4.5 4.5 0 0 1 15.5 19h-7A4.5 4.5 0 0 1 4 14.5v-1A4.5 4.5 0 0 1 8.5 9z' },
    { d: 'M8.6 5.6a4.8 4.8 0 0 1 6.8 0', accent: true },
    { cx: 8.6, cy: 14, r: 0.9, filled: true },
    { cx: 12, cy: 14, r: 0.9, filled: true },
    { cx: 15.4, cy: 14, r: 0.9, filled: true }
  ],
  wifi: [
    { d: 'M4.2 9.6a11.3 11.3 0 0 1 15.6 0' },
    { d: 'M7.6 13a6.5 6.5 0 0 1 8.8 0' },
    { cx: 12, cy: 16.8, r: 1.3, accent: true, filled: true }
  ],
  'id-card': [
    { d: 'M6 5h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z' },
    { cx: 8.8, cy: 10.6, r: 1.9 },
    { d: 'M5.9 16c.4-1.5 1.7-2.3 2.9-2.3s2.5.8 2.9 2.3' },
    { d: 'M14.5 10h3.5', accent: true },
    { d: 'M14.5 13.5h2.4' }
  ],
  check: [
    { d: 'M6.5 12.6l3.6 3.6 7.4-8' }
  ],
  'check-circle': [
    { cx: 12, cy: 12, r: 9 },
    { d: 'M8 12.4l2.7 2.7L16.2 9.6', accent: true }
  ],
  clock: [
    { cx: 12, cy: 12, r: 9 },
    { d: 'M12 7.5V12' },
    { d: 'M12 12l3.2 2', accent: true }
  ],
  calendar: [
    { d: 'M7 5.5h10A3 3 0 0 1 20 8.5v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3z' },
    { d: 'M4 10h16' },
    { d: 'M8.5 3.5v3' },
    { d: 'M15.5 3.5v3' },
    { cx: 12, cy: 15, r: 1.2, accent: true, filled: true }
  ],
  'calendar-check': [
    { d: 'M7 5.5h10A3 3 0 0 1 20 8.5v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3z' },
    { d: 'M4 10h16' },
    { d: 'M8.5 3.5v3' },
    { d: 'M15.5 3.5v3' },
    { d: 'M9.4 15.2l1.9 1.9 3.5-3.7', accent: true }
  ],
  transit: [
    { d: 'M4 9h5' },
    { d: 'M4 15h5' },
    { d: 'M8 12h11' },
    { d: 'M15 8l4 4-4 4', accent: true }
  ],
  wallet: [
    { d: 'M6 6h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z' },
    { d: 'M21 12h-4a2 2 0 0 0 0 4h4' },
    { cx: 17, cy: 14, r: 0.9, accent: true, filled: true }
  ],
  bars: [
    { d: 'M6 20v-6' },
    { d: 'M12 20V5', accent: true },
    { d: 'M18 20V10' }
  ],
  users: [
    { cx: 9, cy: 8.5, r: 3.2 },
    { d: 'M3.5 19.5c.5-3.2 2.9-5 5.5-5s5 1.8 5.5 5' },
    { d: 'M15.5 5.6a3.2 3.2 0 0 1 0 5.8', accent: true },
    { d: 'M17.5 14.6c1.8.6 3 2.2 3.3 4.4', accent: true }
  ],
  sparkle: [
    { d: 'M11 4.5c.5 3.8 1.7 5 5.5 5.5-3.8.5-5 1.7-5.5 5.5-.5-3.8-1.7-5-5.5-5.5 3.8-.5 5-1.7 5.5-5.5z' },
    { d: 'M18.5 15.5v4', accent: true },
    { d: 'M16.5 17.5h4', accent: true }
  ],
  'trend-up': [
    { d: 'M4 16.5l5-5 3.5 3.5L19.5 8' },
    { d: 'M15 8h4.5v4.5', accent: true }
  ],
  coin: [
    { cx: 12, cy: 12, r: 9 },
    { d: 'M12 5.8v1.5' },
    { d: 'M12 16.7v1.5' },
    { d: 'M14.6 9.6c-.4-1-1.4-1.6-2.6-1.6-1.5 0-2.6.8-2.6 2 0 1.3 1.1 1.7 2.6 2.1 1.5.4 2.6.8 2.6 2.1 0 1.2-1.1 2-2.6 2-1.2 0-2.2-.6-2.6-1.6', accent: true }
  ],
  info: [
    { cx: 12, cy: 12, r: 9 },
    { d: 'M12 11v5' },
    { cx: 12, cy: 7.9, r: 0.9, accent: true, filled: true }
  ],
  warning: [
    { d: 'M12 4.3l8.3 14.4a.5.5 0 0 1-.4.8H4.1a.5.5 0 0 1-.4-.8z' },
    { d: 'M12 10v4', accent: true },
    { cx: 12, cy: 16.9, r: 0.8, accent: true, filled: true }
  ],
  error: [
    { cx: 12, cy: 12, r: 9 },
    { d: 'M9.2 9.2l5.6 5.6', accent: true },
    { d: 'M14.8 9.2l-5.6 5.6', accent: true }
  ],
  close: [
    { d: 'M6.5 6.5l11 11' },
    { d: 'M17.5 6.5l-11 11' }
  ],
  pause: [
    { cx: 12, cy: 12, r: 9 },
    { d: 'M10 9v6', accent: true },
    { d: 'M14 9v6', accent: true }
  ],
  play: [
    { cx: 12, cy: 12, r: 9 },
    { d: 'M10.4 8.9v6.2a.5.5 0 0 0 .75.43l5.1-3.1a.5.5 0 0 0 0-.86l-5.1-3.1a.5.5 0 0 0-.75.43z', accent: true }
  ],
  active: [
    { cx: 12, cy: 12, r: 2, accent: true, filled: true },
    { d: 'M8 8.4a5.4 5.4 0 0 0 0 7.2' },
    { d: 'M16 8.4a5.4 5.4 0 0 1 0 7.2' },
    { d: 'M5.2 5.8a9.4 9.4 0 0 0 0 12.4' },
    { d: 'M18.8 5.8a9.4 9.4 0 0 1 0 12.4' }
  ],
  offline: [
    { cx: 12, cy: 12, r: 2 },
    { d: 'M8 8.4a5.4 5.4 0 0 0 0 7.2' },
    { d: 'M16 8.4a5.4 5.4 0 0 1 0 7.2' },
    { d: 'M4.5 19.5l15-15', accent: true }
  ],
  card: [
    { d: 'M6 5.5h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3z' },
    { d: 'M3 10h18', accent: true },
    { d: 'M7 14.5h3' }
  ],
  search: [
    { cx: 11, cy: 11, r: 6.5 },
    { d: 'M16 16l4 4', accent: true }
  ],
  home: [
    { d: 'M4 11.2L12 4.8l8 6.4', accent: true },
    { d: 'M6 9.8V18a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9.8' },
    { d: 'M10 20v-4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20' }
  ],
  mic: [
    { d: 'M12 14.5a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4.5a3 3 0 0 0 3 3z' },
    { d: 'M6.5 11.2a5.5 5.5 0 0 0 11 0' },
    { d: 'M12 16.8V20', accent: true },
    { d: 'M9 20h6', accent: true }
  ],
  bank: [
    { d: 'M3.5 9.2L12 4.5l8.5 4.7', accent: true },
    { d: 'M4.5 19.5h15' },
    { d: 'M7 10.8v5.7' },
    { d: 'M12 10.8v5.7' },
    { d: 'M17 10.8v5.7' }
  ],
  sliders: [
    { d: 'M5 7h8.5' },
    { d: 'M18.5 7H19' },
    { cx: 16, cy: 7, r: 2, accent: true },
    { d: 'M5 17h.5' },
    { d: 'M10.5 17H19' },
    { cx: 8, cy: 17, r: 2, accent: true }
  ],
  qr: [
    { d: 'M5.5 4h3A1.5 1.5 0 0 1 10 5.5v3A1.5 1.5 0 0 1 8.5 10h-3A1.5 1.5 0 0 1 4 8.5v-3A1.5 1.5 0 0 1 5.5 4z' },
    { d: 'M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 14 8.5v-3A1.5 1.5 0 0 1 15.5 4z' },
    { d: 'M5.5 14h3A1.5 1.5 0 0 1 10 15.5v3A1.5 1.5 0 0 1 8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3A1.5 1.5 0 0 1 5.5 14z' },
    { d: 'M14 14h2.2v2.2H14z', accent: true },
    { d: 'M19 14h1', accent: true },
    { d: 'M14 19.5h6', accent: true }
  ],
  plus: [
    { d: 'M12 5v14' },
    { d: 'M5 12h14' }
  ],
  refresh: [
    { d: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3' },
    { d: 'M19.5 4.5v4h-4', accent: true }
  ],
  download: [
    { d: 'M12 4v10.5' },
    { d: 'M7.5 10.5L12 15l4.5-4.5', accent: true },
    { d: 'M5 19.5h14' }
  ],
  trash: [
    { d: 'M4.5 7h15' },
    { d: 'M9.5 7V5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7' },
    { d: 'M6.8 7l.8 11a1.8 1.8 0 0 0 1.8 1.6h5.2a1.8 1.8 0 0 0 1.8-1.6l.8-11' },
    { d: 'M10.5 11v5.2', accent: true },
    { d: 'M13.5 11v5.2', accent: true }
  ],
  more: [
    { cx: 6, cy: 12, r: 1.2, filled: true },
    { cx: 12, cy: 12, r: 1.2, accent: true, filled: true },
    { cx: 18, cy: 12, r: 1.2, filled: true }
  ],
  logout: [
    { d: 'M10 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3' },
    { d: 'M14 8l4 4-4 4', accent: true },
    { d: 'M18 12H9.5', accent: true }
  ],
  menu: [
    { d: 'M5 7h14' },
    { d: 'M5 12h14', accent: true },
    { d: 'M5 17h14' }
  ],
  'chevron-left': [
    { d: 'M14.5 6l-6 6 6 6' }
  ],
  'chevron-right': [
    { d: 'M9.5 6l6 6-6 6' }
  ],
  'chevron-down': [
    { d: 'M6 9.5l6 6 6-6' }
  ],
  shield: [
    { d: 'M12 3.5l7 2.6v5.4c0 4.2-2.8 7.6-7 9-4.2-1.4-7-4.8-7-9V6.1z' },
    { d: 'M9 12l2.2 2.2 4.3-4.4', accent: true }
  ],
  bolt: [
    { d: 'M13 3.5L6.5 13.2h5.2l-.7 7.3 6.5-9.7H12z', accent: true }
  ],
  volume: [
    { d: 'M4.5 10v4h3L12 18V6L7.5 10z' },
    { d: 'M15.5 9a4 4 0 0 1 0 6', accent: true },
    { d: 'M18 6.5a7.5 7.5 0 0 1 0 11', accent: true }
  ],
  bulb: [
    { d: 'M12 3.5a5.5 5.5 0 0 0-3.3 9.9c.5.4.8 1 .8 1.6v.5h5v-.5c0-.6.3-1.2.8-1.6A5.5 5.5 0 0 0 12 3.5z' },
    { d: 'M9.8 18h4.4', accent: true },
    { d: 'M10.5 20.5h3', accent: true }
  ],
  sun: [
    { cx: 12, cy: 12, r: 3.6 },
    { d: 'M12 3.5v2', accent: true },
    { d: 'M12 18.5v2', accent: true },
    { d: 'M3.5 12h2', accent: true },
    { d: 'M18.5 12h2', accent: true },
    { d: 'M6 6l1.4 1.4', accent: true },
    { d: 'M16.6 16.6L18 18', accent: true },
    { d: 'M18 6l-1.4 1.4', accent: true },
    { d: 'M7.4 16.6L6 18', accent: true }
  ],
  music: [
    { cx: 6.5, cy: 17.5, r: 2.5 },
    { cx: 15.5, cy: 15.5, r: 2.5 },
    { d: 'M9 17.5V6.5' },
    { d: 'M18 15.5V4.5' },
    { d: 'M9 6.5l9-2', accent: true }
  ]
} satisfies Record<string, Shape[]>

export type BrandIconName = keyof typeof SHAPES
export const BRAND_ICON_NAMES = Object.keys(SHAPES) as BrandIconName[]

export type IconTone = 'brand' | 'muted' | 'inverse' | 'current'

const TONES: Record<IconTone, { outline: string; detail: string }> = {
  brand: { outline: '#0891A6', detail: '#E5548C' },
  muted: { outline: '#94A3B8', detail: '#94A3B8' },
  inverse: { outline: '#FFFFFF', detail: '#FFFFFF' },
  current: { outline: 'currentColor', detail: 'currentColor' }
}

interface BrandIconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'color'> {
  name: BrandIconName
  size?: number
  tone?: IconTone
  /** One color for the whole icon; overrides tone */
  color?: string
  strokeWidth?: number
  title?: string
}

export function BrandIcon({ name, size = 24, tone = 'brand', color, strokeWidth = 1.6, title, ...rest }: BrandIconProps) {
  const outline = color ?? TONES[tone].outline
  const detail = color ?? TONES[tone].detail
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title && <title>{title}</title>}
      {SHAPES[name].map((shape: Shape, i: number) => {
        const stroke = shape.accent ? detail : outline
        if ('d' in shape) return <path key={i} d={shape.d} stroke={stroke} />
        return <circle key={i} cx={shape.cx} cy={shape.cy} r={shape.r} stroke={stroke} fill={shape.filled ? stroke : 'none'} />
      })}
    </svg>
  )
}

export type IconTileState = 'current' | 'done' | 'upcoming'

/** A soft round tile behind an icon, used for step lists. A finished step keeps its icon and gains a check badge. */
export function IconTile({ name, state = 'current', size = 40 }: { name: BrandIconName; state?: IconTileState; size?: number }) {
  const upcoming = state === 'upcoming'
  const badge = Math.round(size * 0.42)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: '9999px',
          background: upcoming ? '#F1F5F9' : '#E6F6F9',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <BrandIcon name={name} size={Math.round(size * 0.55)} tone={upcoming ? 'muted' : 'brand'} />
      </span>
      {state === 'done' && (
        <span
          style={{
            position: 'absolute',
            right: -3,
            bottom: -3,
            width: badge,
            height: badge,
            borderRadius: '9999px',
            background: '#0891A6',
            border: '2px solid #FFFFFF',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <BrandIcon name="check" size={Math.round(size * 0.24)} tone="inverse" strokeWidth={3.2} />
        </span>
      )}
    </span>
  )
}
