import { useState, type ReactNode } from 'react'

interface TooltipProps {
  label: string
  content: ReactNode
}

/**
 * Accessible help tooltip button that reveals content on hover or keyboard focus.
 */
export function Tooltip({ label, content }: TooltipProps) {
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={label}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-600 bg-neutral-800 text-[10px] font-semibold text-neutral-400 transition-colors hover:border-neutral-500 hover:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-400"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-1.5 w-60 -translate-x-1/2 rounded-lg bg-neutral-900 px-3 py-2 text-xs leading-relaxed text-neutral-200 shadow-xl border border-neutral-700 pointer-events-none"
        >
          {content}
        </span>
      )}
    </span>
  )
}
