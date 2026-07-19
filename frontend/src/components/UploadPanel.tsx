import { useState, useRef, useCallback } from 'react'
import { fetchDeadlines, makeManualDeadline, type Deadline, type UnresolvedItem } from '../lib/extractor'

const SANS = "'Inter', system-ui, sans-serif"

interface Props {
  onExtract: (deadlines: Deadline[]) => void
}

function IconStroke({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="38" height="30" viewBox="0 0 40 32" fill="none">
      <path d="M2 5a2 2 0 0 1 2-2h8l3 3h21a2 2 0 0 1 2 2v2H2V5Z" fill="#2f7dc9" />
      <rect x="2" y="7" width="36" height="21" rx="3" fill="#3d92e0" />
      <path
        className="origin-bottom transition-transform duration-200 ease-out group-hover/pdf:translate-y-[3px] group-hover/pdf:scale-y-95"
        d="M2 26.5a3 3 0 0 0 3 3h30a3 3 0 0 0 3-3L36.5 16h-33L2 26.5Z"
        fill="#5fb0e8"
      />
    </svg>
  )
}

function DocFileIcon() {
  return (
    <svg
      width="32"
      height="38"
      viewBox="0 0 40 46"
      fill="none"
      className="transition-transform duration-200 ease-out group-hover/img:-translate-y-0.5 group-hover/img:rotate-2"
      style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))' }}
    >
      <path
        d="M4 3a2 2 0 0 1 2-2h20l10 10v32a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V3Z"
        fill="#fff"
        stroke="#b3b3b3"
        strokeWidth="1.25"
      />
      <path d="M26 1v8a2 2 0 0 0 2 2h8L26 1Z" fill="#e2e2e2" stroke="#b3b3b3" strokeWidth="1" />
      <g stroke="#999" strokeWidth="1.4" strokeLinecap="round">
        <line x1="9" y1="14" x2="27" y2="14" />
        <line x1="9" y1="18" x2="24" y2="18" />
        <line x1="9" y1="22" x2="26" y2="22" />
        <line x1="9" y1="26" x2="20" y2="26" />
        <line x1="9" y1="33" x2="25" y2="33" />
        <line x1="9" y1="37" x2="18" y2="37" />
      </g>
    </svg>
  )
}

function CheckIcon({ color }: { color: string }) {
  return (
    <IconStroke color={color}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5.5" />
    </IconStroke>
  )
}

export default function UploadPanel({ onExtract }: Props) {
  const [pdfDrag, setPdfDrag] = useState(false)
  const [imgDrag, setImgDrag] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [imgFile, setImgFile] = useState<File | null>(null)
  const [pastedText, setPastedText] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noResults, setNoResults] = useState(false)
  const [unreadableImage, setUnreadableImage] = useState(false)
  const [unresolvedItems, setUnresolvedItems] = useState<UnresolvedItem[]>([])
  const [pendingDeadlines, setPendingDeadlines] = useState<Deadline[]>([])
  const [showManual, setShowManual] = useState(false)
  const [manualEntries, setManualEntries] = useState<{ title: string; date: string }[]>([{ title: '', date: '' }])
  const pdfRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((file: File, kind: 'pdf' | 'img') => {
    if (kind === 'pdf') setPdfFile(file)
    else setImgFile(file)
  }, [])

  const canExtract = !!(pdfFile || imgFile || pastedText.trim().length > 5)

  const handleExtract = async () => {
    if (!canExtract || loading) return
    setError(null)
    setLoading(true)
    try {
      const result = await fetchDeadlines(pdfFile, imgFile, pastedText || undefined)
      if (result.unreadableImage) {
        setUnreadableImage(true)
      } else if (result.unresolved.length > 0) {
        setPendingDeadlines(result.deadlines)
        setUnresolvedItems(result.unresolved)
      } else if (result.deadlines.length === 0) {
        setNoResults(true)
      } else {
        onExtract(result.deadlines)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleReupload = () => {
    setNoResults(false)
    setUnreadableImage(false)
    setUnresolvedItems([])
    setPendingDeadlines([])
    setPdfFile(null)
    setImgFile(null)
    setPastedText('')
  }

  const handleManualAdd = (title: string, dateStr: string) => {
    onExtract([makeManualDeadline(title, dateStr)])
  }

  const handleUnresolvedContinue = (dates: string[]) => {
    const filled = unresolvedItems
      .map((item, i) => (dates[i] ? makeManualDeadline(item.title || 'Untitled deadline', dates[i]) : null))
      .filter((d): d is Deadline => d !== null)
    const combined = [...pendingDeadlines, ...filled]
    setUnresolvedItems([])
    setPendingDeadlines([])
    if (combined.length === 0) setNoResults(true)
    else onExtract(combined)
  }

  const handleUnresolvedSkip = () => {
    const combined = pendingDeadlines
    setUnresolvedItems([])
    setPendingDeadlines([])
    if (combined.length === 0) setNoResults(true)
    else onExtract(combined)
  }

  const updateManualEntry = (index: number, field: 'title' | 'date', value: string) => {
    setManualEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)))
  }

  const addManualEntryRow = () => {
    setManualEntries((prev) => [...prev, { title: '', date: '' }])
  }

  const removeManualEntryRow = (index: number) => {
    setManualEntries((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  const validManualEntries = manualEntries.filter((e) => e.title.trim() && e.date)

  const handleManualSubmit = () => {
    if (validManualEntries.length === 0) return
    onExtract(validManualEntries.map((e) => makeManualDeadline(e.title.trim(), e.date)))
  }

  const ZONE = (drag: boolean, filled: boolean): React.CSSProperties => ({
    background: filled ? '#f0fbf4' : drag ? '#f0ece6' : '#faf8f4',
    border: filled ? '1.5px solid #86d9a8' : `1.5px dashed ${drag ? '#999' : '#d4cec6'}`,
    borderRadius: '12px',
    transition: 'all 0.15s ease',
    cursor: 'pointer',
    position: 'relative',
  })

  return (
    <div
      className="rounded-2xl p-5 text-left"
      style={{ background: '#fff', border: '1px solid #e8e3db', boxShadow: '0 2px 24px rgba(0,0,0,0.06)' }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: '#bbb', fontFamily: SANS }}>
        Upload Files
      </p>

      {/* Drop zones */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          {
            label: 'PDF document', icon: () => <FolderIcon />, groupClass: 'group/pdf', drag: pdfDrag, fileName: pdfFile?.name ?? null,
            ref: pdfRef, accept: '.pdf',
            onDragOver: () => setPdfDrag(true), onDragLeave: () => setPdfDrag(false),
            onDrop: (e: React.DragEvent) => { e.preventDefault(); setPdfDrag(false); const f = e.dataTransfer.files[0]; if (f) handleDrop(f, 'pdf') },
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleDrop(f, 'pdf') },
            onClear: () => setPdfFile(null),
            note: undefined as string | undefined,
          },
          {
            label: 'Screenshot', icon: () => <DocFileIcon />, groupClass: 'group/img', drag: imgDrag, fileName: imgFile?.name ?? null,
            ref: imgRef, accept: 'image/*',
            onDragOver: () => setImgDrag(true), onDragLeave: () => setImgDrag(false),
            onDrop: (e: React.DragEvent) => { e.preventDefault(); setImgDrag(false); const f = e.dataTransfer.files[0]; if (f) handleDrop(f, 'img') },
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleDrop(f, 'img') },
            onClear: () => setImgFile(null),
            note: "(works best with typed text — handwriting isn't supported yet)",
          },
        ].map((z) => {
          const filled = !!z.fileName
          return (
            <div
              key={z.label}
              style={ZONE(z.drag, filled)}
              className={`flex flex-col items-center justify-center gap-2 py-8 select-none ${z.groupClass}`}
              onClick={() => z.ref.current?.click()}
              onDragOver={(e) => { e.preventDefault(); z.onDragOver() }}
              onDragLeave={z.onDragLeave}
              onDrop={z.onDrop}
            >
              {filled && (
                <button
                  onClick={(e) => { e.stopPropagation(); z.onClear() }}
                  className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full text-xs"
                  style={{ background: '#fff', color: '#999', border: '1px solid #e8e3db', lineHeight: 1 }}
                  aria-label={`Remove ${z.label}`}
                  title="Remove file"
                >
                  ×
                </button>
              )}
              {filled ? <CheckIcon color="#3fa866" /> : z.icon()}
              <div className="text-center px-2">
                <p className="text-xs font-medium truncate max-w-[140px]" style={{ color: filled ? '#1a7a3f' : '#444', fontFamily: SANS }}>
                  {z.fileName ?? z.label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: filled ? '#3fa866' : '#777', fontFamily: SANS }}>
                  {filled ? 'Uploaded' : 'Click or drag & drop'}
                </p>
                {!filled && z.note && (
                  <p className="text-[10px] mt-1.5 leading-tight italic max-w-[130px] mx-auto" style={{ color: '#aaa', fontFamily: SANS }}>
                    {z.note}
                  </p>
                )}
              </div>
              <input ref={z.ref} type="file" accept={z.accept} className="hidden" onChange={z.onChange} />
            </div>
          )
        })}
      </div>

      {/* Paste toggle */}
      <div className="mb-4">
        <button
          className="text-sm transition-colors"
          style={{ color: '#777', fontFamily: SANS }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#333')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#777')}
          onClick={() => setShowPaste((v) => !v)}
        >
          {showPaste ? '▾' : '▸'} or paste text directly
        </button>
        {showPaste && (
          <textarea
            className="w-full mt-2 px-4 py-3 text-sm resize-none focus:outline-none"
            style={{
              background: '#faf8f4',
              border: '1.5px dashed #d4cec6',
              borderRadius: '12px',
              minHeight: '110px',
              color: '#333',
              fontFamily: SANS,
            }}
            placeholder="Paste an email, contract, or any text with dates…"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            spellCheck={false}
          />
        )}
      </div>

      {/* Manual entry */}
      <div className="mb-3">
        <button
          className="text-sm transition-colors"
          style={{ color: '#777', fontFamily: SANS }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#333')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#777')}
          onClick={() => setShowManual((v) => !v)}
        >
          {showManual ? '▾' : '+'} add deadline manually
        </button>
        {showManual && (
          <div className="mt-2 p-3" style={{ background: '#faf8f4', border: '1px solid #e8e3db', borderRadius: '10px' }}>
              {manualEntries.map((entry, i) => (
                <div key={i}>
                  {i > 0 && <div className="my-3" style={{ borderTop: '1px dashed #e0dbd2' }} />}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1">
                      <input
                        value={entry.title}
                        onChange={(e) => updateManualEntry(i, 'title', e.target.value)}
                        placeholder="Deadline title"
                        className="w-full mb-2 px-3 py-2 text-sm focus:outline-none"
                        style={{ background: '#fff', border: '1px solid #e8e3db', borderRadius: '8px', color: '#333', fontFamily: SANS }}
                      />
                      <input
                        type="date"
                        value={entry.date}
                        onChange={(e) => updateManualEntry(i, 'date', e.target.value)}
                        className="w-full px-3 py-2 text-sm focus:outline-none"
                        style={{ background: '#fff', border: '1px solid #e8e3db', borderRadius: '8px', color: '#333', fontFamily: SANS }}
                      />
                    </div>
                    {manualEntries.length > 1 && (
                      <button
                        onClick={() => removeManualEntryRow(i)}
                        className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-xs"
                        style={{ background: '#fff', color: '#999', border: '1px solid #e8e3db', lineHeight: 1 }}
                        aria-label="Remove entry"
                        title="Remove entry"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button
                onClick={addManualEntryRow}
                className="text-xs mb-3 transition-colors"
                style={{ color: '#999', fontFamily: SANS }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#555')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#999')}
              >
                + add another
              </button>

              <button
                disabled={validManualEntries.length === 0}
                onClick={handleManualSubmit}
                className="w-full py-2.5 rounded-lg text-xs font-semibold text-white transition-all duration-150"
                style={{
                  background: validManualEntries.length > 0 ? '#1a1a1a' : '#e8e3db',
                  color: validManualEntries.length > 0 ? '#fff' : '#bbb',
                  cursor: validManualEntries.length > 0 ? 'pointer' : 'not-allowed',
                  fontFamily: SANS,
                }}
              >
                {validManualEntries.length > 1 ? `Add ${validManualEntries.length} deadlines` : 'Add deadline'}
              </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs mb-3" style={{ color: '#dc2626', fontFamily: SANS }}>
          {error}
        </p>
      )}

      {/* CTA */}
      <button
        disabled={!canExtract || loading}
        onClick={handleExtract}
        className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all duration-150"
        style={{
          background: canExtract && !loading ? '#1a1a1a' : '#e8e3db',
          color: canExtract && !loading ? '#fff' : '#bbb',
          cursor: canExtract && !loading ? 'pointer' : 'not-allowed',
          fontFamily: SANS,
        }}
        onMouseEnter={(e) => { if (canExtract && !loading) (e.currentTarget as HTMLButtonElement).style.background = '#333' }}
        onMouseLeave={(e) => { if (canExtract && !loading) (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a' }}
      >
        {loading ? 'Extracting…' : 'Extract Deadlines'}
      </button>

      {loading && <LoadingOverlay />}
      {noResults && <NoResultsModal onReupload={handleReupload} onManualAdd={handleManualAdd} />}
      {unreadableImage && <UnreadableImageModal onReupload={handleReupload} onManualAdd={handleManualAdd} />}
      {unresolvedItems.length > 0 && (
        <UnresolvedItemsModal
          items={unresolvedItems}
          onContinue={handleUnresolvedContinue}
          onSkip={handleUnresolvedSkip}
        />
      )}
    </div>
  )
}

function NoResultsModal({
  onReupload,
  onManualAdd,
}: {
  onReupload: () => void
  onManualAdd: (title: string, dateStr: string) => void
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(26,26,26,0.35)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="rounded-2xl px-8 py-7 text-center"
        style={{ background: '#fff', border: '1px solid #e8e3db', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', width: '300px' }}
      >
        <p className="text-sm font-semibold mb-1.5" style={{ color: '#1a1a1a', fontFamily: SANS }}>
          No deadlines found
        </p>
        <p className="text-xs mb-5" style={{ color: '#999', fontFamily: SANS }}>
          We couldn't detect any dates in what you provided. Add one manually, or try a different file or text.
        </p>
        <ManualAddForm onManualAdd={onManualAdd} />
        <button
          onClick={onReupload}
          className="text-xs transition-colors"
          style={{ color: '#bbb', fontFamily: SANS }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#555')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#bbb')}
        >
          Reupload instead
        </button>
      </div>
    </div>
  )
}

function UnreadableImageModal({
  onReupload,
  onManualAdd,
}: {
  onReupload: () => void
  onManualAdd: (title: string, dateStr: string) => void
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(26,26,26,0.35)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="rounded-2xl px-8 py-7 text-center"
        style={{ background: '#fff', border: '1px solid #e8e3db', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', width: '300px' }}
      >
        <p className="text-sm font-semibold mb-1.5" style={{ color: '#1a1a1a', fontFamily: SANS }}>
          We couldn't read this image
        </p>
        <p className="text-xs mb-5" style={{ color: '#999', fontFamily: SANS }}>
          It may be handwritten or low resolution. Add the deadline manually?
        </p>
        <ManualAddForm onManualAdd={onManualAdd} />
        <button
          onClick={onReupload}
          className="text-xs transition-colors"
          style={{ color: '#bbb', fontFamily: SANS }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#555')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#bbb')}
        >
          Reupload instead
        </button>
      </div>
    </div>
  )
}

function ManualAddForm({ onManualAdd }: { onManualAdd: (title: string, dateStr: string) => void }) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')

  const canAdd = title.trim().length > 0 && date.length > 0

  return showForm ? (
    <div className="text-left mb-4">
      <label className="text-[10px] font-medium block mb-1" style={{ color: '#999', fontFamily: SANS }}>
        Title
      </label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Mini Project Submission"
        className="w-full mb-3 px-3 py-2 text-sm focus:outline-none"
        style={{ background: '#faf8f4', border: '1px solid #e8e3db', borderRadius: '8px', color: '#333', fontFamily: SANS }}
      />
      <label className="text-[10px] font-medium block mb-1" style={{ color: '#999', fontFamily: SANS }}>
        Date
      </label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full mb-4 px-3 py-2 text-sm focus:outline-none"
        style={{ background: '#faf8f4', border: '1px solid #e8e3db', borderRadius: '8px', color: '#333', fontFamily: SANS }}
      />
      <button
        disabled={!canAdd}
        onClick={() => onManualAdd(title.trim(), date)}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-150"
        style={{ background: canAdd ? '#1a1a1a' : '#e8e3db', color: canAdd ? '#fff' : '#bbb', cursor: canAdd ? 'pointer' : 'not-allowed', fontFamily: SANS }}
        onMouseEnter={(e) => { if (canAdd) (e.currentTarget as HTMLButtonElement).style.background = '#333' }}
        onMouseLeave={(e) => { if (canAdd) (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a' }}
      >
        Add deadline
      </button>
    </div>
  ) : (
    <button
      onClick={() => setShowForm(true)}
      className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-150 mb-2"
      style={{ background: '#1a1a1a', fontFamily: SANS }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#333' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a' }}
    >
      Add manually
    </button>
  )
}

function UnresolvedItemsModal({
  items,
  onContinue,
  onSkip,
}: {
  items: UnresolvedItem[]
  onContinue: (dates: string[]) => void
  onSkip: () => void
}) {
  const [dates, setDates] = useState<string[]>(() => items.map(() => ''))

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 px-4"
      style={{ background: 'rgba(26,26,26,0.35)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="rounded-2xl px-8 py-7 text-center"
        style={{ background: '#fff', border: '1px solid #e8e3db', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', width: '320px', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <p className="text-sm font-semibold mb-1.5" style={{ color: '#1a1a1a', fontFamily: SANS }}>
          Couldn't find a date for {items.length > 1 ? `${items.length} deadlines` : 'this deadline'}
        </p>
        <p className="text-xs mb-5" style={{ color: '#999', fontFamily: SANS }}>
          No day number was mentioned in the source for {items.length > 1 ? 'these' : 'this'}. Add a date manually, or skip.
        </p>

        <div className="text-left">
          {items.map((item, i) => (
            <div key={i} className="mb-4">
              <p className="text-xs font-medium mb-1 truncate" style={{ color: '#333', fontFamily: SANS }} title={item.title}>
                {item.title || 'Untitled deadline'}
              </p>
              <input
                type="date"
                value={dates[i]}
                onChange={(e) => setDates((prev) => prev.map((d, j) => (j === i ? e.target.value : d)))}
                className="w-full px-3 py-2 text-sm focus:outline-none"
                style={{ background: '#faf8f4', border: '1px solid #e8e3db', borderRadius: '8px', color: '#333', fontFamily: SANS }}
              />
            </div>
          ))}
        </div>

        <button
          onClick={() => onContinue(dates)}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-150 mb-2"
          style={{ background: '#1a1a1a', fontFamily: SANS }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#333' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a' }}
        >
          Continue
        </button>
        <button
          onClick={onSkip}
          className="text-xs transition-colors"
          style={{ color: '#bbb', fontFamily: SANS }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#555')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#bbb')}
        >
          Skip these
        </button>
      </div>
    </div>
  )
}

function LoadingOverlay() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(26,26,26,0.35)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="rounded-2xl px-8 py-7 text-center"
        style={{ background: '#fff', border: '1px solid #e8e3db', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', width: '260px' }}
      >
        <p className="text-sm font-medium mb-4" style={{ color: '#333', fontFamily: SANS }}>
          Finding your deadlines…
        </p>
        <div
          className="w-full h-1.5 rounded-full overflow-hidden"
          style={{ background: '#f0ece6' }}
        >
          <div className="loading-bar-fill h-full rounded-full" style={{ background: '#1a1a1a' }} />
        </div>
      </div>
    </div>
  )
}
