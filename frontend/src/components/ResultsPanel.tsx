import { useState } from 'react'
import type { Deadline, Urgency } from '../lib/extractor'
import { downloadIcs } from '../lib/extractor'
import DeadlineRow from './DeadlineRow'

type Filter = 'all' | Urgency
const SANS = "'Inter', system-ui, sans-serif"

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'this-week', label: 'This week' },
  { key: 'upcoming', label: 'Upcoming' },
]

interface Props {
  deadlines: Deadline[]
  onReset: () => void
  onRename: (id: string, newText: string) => void
  onDateChange: (id: string, newDateStr: string) => void
}

export default function ResultsPanel({ deadlines, onReset, onRename, onDateChange }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const filtered = filter === 'all' ? deadlines : deadlines.filter((d) => d.urgency === filter)
  const counts: Record<string, number> = { all: deadlines.length }
  for (const d of deadlines) counts[d.urgency] = (counts[d.urgency] || 0) + 1

  const handleCopy = () => {
    const lines = deadlines.map((d) =>
      `[${d.urgency.toUpperCase()}] ${d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — ${d.text}`
    )
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExport = async () => {
    setExportError(null)
    setExporting(true)
    try {
      await downloadIcs(deadlines)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className="rounded-2xl overflow-hidden text-left"
      style={{ background: '#fff', border: '1px solid #e8e3db', boxShadow: '0 2px 24px rgba(0,0,0,0.06)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #f0ece6' }}>
        <span className="text-sm font-semibold" style={{ color: '#1a1a1a', fontFamily: SANS }}>
          {deadlines.length} deadline{deadlines.length !== 1 ? 's' : ''} found
        </span>
        <button
          onClick={handleCopy}
          title="Copy the deadline list as plain text"
          className="text-xs transition-colors"
          style={{ color: '#bbb', fontFamily: SANS }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#555')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#bbb')}
        >
          {copied ? '✓ Copied' : '⎘ Copy as text'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-0 overflow-x-auto px-4 pt-2" style={{ borderBottom: '1px solid #f0ece6' }}>
        {FILTERS.filter((f) => f.key === 'all' || (counts[f.key] || 0) > 0).map((f) => {
          const active = filter === f.key
          const count = counts[f.key] || 0
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-3 py-2 text-xs whitespace-nowrap transition-all duration-150"
              style={{
                fontFamily: SANS,
                fontWeight: active ? 600 : 400,
                color: active ? '#1a1a1a' : '#bbb',
                borderBottom: active ? '2px solid #1a1a1a' : '2px solid transparent',
                background: 'transparent',
              }}
            >
              {f.label} ({count})
            </button>
          )
        })}
      </div>

      {/* List */}
      <div className="max-h-72 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-center text-xs py-10" style={{ color: '#ccc', fontFamily: SANS }}>
            {deadlines.length === 0 ? 'No dates detected.' : 'Nothing in this category.'}
          </p>
        ) : (
          filtered.map((d, i) => (
            <DeadlineRow key={d.id} deadline={d} index={i} total={filtered.length} onRename={onRename} onDateChange={onDateChange} />
          ))
        )}
      </div>

      {/* Export */}
      <div className="px-5 py-4" style={{ borderTop: '1px solid #f0ece6' }}>
        {exportError && (
          <p className="text-xs mb-2" style={{ color: '#dc2626', fontFamily: SANS }}>{exportError}</p>
        )}
        <div className="flex gap-2">
          <button
            disabled={exporting}
            onClick={handleExport}
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-white transition-all duration-150"
            style={{ background: exporting ? '#999' : '#1a1a1a', fontFamily: SANS, cursor: exporting ? 'not-allowed' : 'pointer' }}
            onMouseEnter={(e) => { if (!exporting) (e.currentTarget as HTMLButtonElement).style.background = '#333' }}
            onMouseLeave={(e) => { if (!exporting) (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a' }}
          >
            {exporting ? 'Exporting…' : 'Export as .ics calendar file'}
          </button>
          <button
            onClick={onReset}
            className="shrink-0 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-150"
            style={{ background: '#faf8f4', color: '#555', border: '1px solid #e8e3db', fontFamily: SANS }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f0ece6' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#faf8f4' }}
          >
            Upload another
          </button>
        </div>
      </div>
    </div>
  )
}
