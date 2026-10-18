interface SwitchProps {
  checked: boolean
  onChange: () => void
  label: string
  disabled?: boolean
}

/** An on/off switch. The label is read by screen readers; the visible text sits beside it. */
export function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 ${
        checked ? 'bg-brand-700' : 'bg-slate-300'
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  )
}
