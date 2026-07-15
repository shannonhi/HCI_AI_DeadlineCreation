import type { Deadline } from '../lib/extractor'

const SANS = "'Inter', system-ui, sans-serif"

const URGENCY_CONFIG = {
  overdue:     { label: 'Overdue',   pillBg: '#fef2f2', pillText: '#dc2626' },
  today:       { label: 'Today',     pillBg: '#fffbeb', pillText: '#d97706' },
  'this-week': { label: 'This week', pillBg: '#f0f9ff', pillText: '#0369a1' },
  upcoming:    { label: 'Upcoming',  pillBg: '#f7f5f0', pillText: '#999' },
}

interface Props {
  deadline: Deadline
  index: number
  total: number
}

export default function DeadlineRow({ deadline, index, total }: Props) {
  const cfg = URGENCY_CONFIG[deadline.urgency]
  const isLast = index === total - 1

  const daysFromNow = Math.floor(
    (new Date(deadline.date.getFullYear(), deadline.date.getMonth(), deadline.date.getDate()).getTime() -
      new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()) /
      86400000
  )
  const daysLabel =
    daysFromNow === 0 ? 'today' :
    daysFromNow < 0 ? `${Math.abs(daysFromNow)}d overdue` :
    `in ${daysFromNow}d`

  return (
    <div
      className="flex items-start gap-3 px-5 py-3.5 transition-colors duration-100 cursor-default"
      style={{ borderBottom: isLast ? 'none' : '1px solid #f5f1ec' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#faf8f4')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Date */}
      <div className="shrink-0 w-14">
        <div className="text-sm font-semibold" style={{ color: '#1a1a1a', fontFamily: SANS }}>
          {deadline.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: '#bbb', fontFamily: SANS }}>{daysLabel}</div>
      </div>

      {/* Pill */}
      <span
        className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full mt-0.5"
        style={{ background: cfg.pillBg, color: cfg.pillText, fontFamily: SANS }}
      >
        {cfg.label}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate" style={{ color: '#333', fontFamily: SANS }} title={deadline.context}>
          {deadline.text}
        </div>
        <div className="text-[10px] truncate mt-0.5" style={{ color: '#ccc', fontFamily: SANS }}>
          {deadline.context}
        </div>
      </div>

      <div className="shrink-0 text-[10px] hidden sm:block" style={{ color: '#ddd', fontFamily: SANS }}>
        {deadline.date.getFullYear()}
      </div>
    </div>
  )
}
