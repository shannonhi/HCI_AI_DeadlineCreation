import { useState, useRef, useEffect } from 'react'
import type { Deadline } from '../lib/extractor'

const SANS = "'Inter', system-ui, sans-serif"

const URGENCY_CONFIG = {
  overdue:     { label: 'Overdue',   pillBg: '#fef2f2', pillText: '#dc2626' },
  today:       { label: 'Today',     pillBg: '#fffbeb', pillText: '#d97706' },
  'this-week': { label: 'This week', pillBg: '#f0f9ff', pillText: '#0369a1' },
  upcoming:    { label: 'Upcoming',  pillBg: '#f5f3ff', pillText: '#7c3aed' },
}

interface Props {
  deadline: Deadline
  index: number
  total: number
  onRename: (id: string, newText: string) => void
  onDateChange: (id: string, newDateStr: string) => void
}

function getDateBadge(deadline: Deadline): { label: string; tooltip: string } | null {
  if (deadline.dateFormatAmbiguous) {
    switch (deadline.dateFormatReason) {
      case 'inferred':
        return {
          label: 'date inferred, click date to change',
          tooltip: 'This date was ambiguous (could be DD/MM or MM/DD) but other dates in this document made the format clear. Click to edit.',
        }
      case 'conflicting':
        return {
          label: 'date format uncertain',
          tooltip: 'This document has conflicting date formats — some dates only work as DD/MM, others only as MM/DD. Click to edit.',
        }
      case 'assumed':
      default:
        return {
          label: 'date format assumed DD/MM',
          tooltip: 'The source date could be DD/MM or MM/DD — we assumed DD/MM. Click to edit.',
        }
    }
  }
  if (deadline.dateEstimated) {
    return {
      label: 'date estimated',
      tooltip: 'The source text only gave a day number with no month — this date was estimated as the next occurrence of that day. Click to edit.',
    }
  }
  return null
}

export default function DeadlineRow({ deadline, index, total, onRename, onDateChange }: Props) {
  const cfg = URGENCY_CONFIG[deadline.urgency]
  const isLast = index === total - 1
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(deadline.text)
  const [editingDate, setEditingDate] = useState(false)
  const [dateDraft, setDateDraft] = useState(deadline.rawDate)
  const inputRef = useRef<HTMLInputElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  useEffect(() => {
    if (editingDate) dateInputRef.current?.focus()
  }, [editingDate])

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== deadline.text) onRename(deadline.id, trimmed)
    else setDraft(deadline.text)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(deadline.text)
    setEditing(false)
  }

  const commitDate = () => {
    if (dateDraft && dateDraft !== deadline.rawDate) onDateChange(deadline.id, dateDraft)
    setEditingDate(false)
  }

  const cancelDate = () => {
    setDateDraft(deadline.rawDate)
    setEditingDate(false)
  }

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
      <div className="shrink-0 w-20">
        {editingDate ? (
          <input
            ref={dateInputRef}
            type="date"
            value={dateDraft}
            onChange={(e) => setDateDraft(e.target.value)}
            onBlur={commitDate}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitDate() }
              if (e.key === 'Escape') { e.preventDefault(); cancelDate() }
            }}
            className="text-xs w-full focus:outline-none"
            style={{
              color: '#333',
              fontFamily: SANS,
              background: '#faf8f4',
              border: '1px solid #d4cec6',
              borderRadius: '6px',
              padding: '2px 4px',
            }}
          />
        ) : (
          <button
            onClick={() => setEditingDate(true)}
            className="text-left transition-opacity hover:opacity-70"
            style={{ background: 'transparent', border: 'none', padding: 0, margin: 0, cursor: 'pointer' }}
            title="Click to change the date"
          >
            <div className="text-sm font-semibold" style={{ color: '#1a1a1a', fontFamily: SANS }}>
              {deadline.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <div className="text-sm font-semibold" style={{ color: '#1a1a1a', fontFamily: SANS }}>
              {deadline.date.getFullYear()}
            </div>
          </button>
        )}
      </div>

      {/* Pill */}
      <div className="shrink-0 flex flex-col items-start gap-1 mt-0.5">
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full -ml-2"
          style={{ background: cfg.pillBg, color: cfg.pillText, fontFamily: SANS }}
        >
          {cfg.label}
        </span>
        <span className="text-[10px] font-medium" style={{ color: '#777', fontFamily: SANS }}>
          {daysLabel}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit() }
              if (e.key === 'Escape') { e.preventDefault(); cancel() }
            }}
            className="text-sm w-full focus:outline-none"
            style={{
              color: '#333',
              fontFamily: SANS,
              background: '#faf8f4',
              border: '1px solid #d4cec6',
              borderRadius: '6px',
              padding: '2px 6px',
            }}
          />
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap group/name">
            <span className="text-sm truncate" style={{ color: '#333', fontFamily: SANS }} title={deadline.context}>
              {deadline.text}
            </span>
            <button
              onClick={() => setEditing(true)}
              className="shrink-0 transition-colors"
              style={{ color: '#bbb' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#1a1a1a')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#bbb')}
              aria-label="Rename deadline"
              title="Rename"
            >
              ✎
            </button>
            {(() => {
              const badge = getDateBadge(deadline)
              return badge ? (
                <div className="basis-full -ml-2">
                  <button
                    onClick={() => setEditingDate(true)}
                    className="text-left text-[10px] font-medium px-2 py-0.5 rounded-full transition-opacity hover:opacity-80"
                    style={{ background: '#fffbeb', color: '#b45309', fontFamily: SANS, margin: 0 }}
                    title={badge.tooltip}
                  >
                    {badge.label}
                  </button>
                </div>
              ) : null
            })()}
          </div>
        )}
        <div className="text-[10px] truncate mt-0.5" style={{ color: '#777', fontFamily: SANS }}>
          {deadline.context}
        </div>
      </div>
    </div>
  )
}
