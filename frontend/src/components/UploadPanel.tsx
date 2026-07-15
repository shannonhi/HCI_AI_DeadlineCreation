import { useState, useRef, useCallback } from 'react'
import { fetchDeadlines, type Deadline } from '../lib/extractor'

const SANS = "'Inter', system-ui, sans-serif"

interface Props {
  onExtract: (deadlines: Deadline[]) => void
}

const EXAMPLE = "The proposal must be submitted by August 15, 2026. All team leads should complete their section reviews no later than August 8, 2026. The client presentation is scheduled for July 25, 2026. Invoice payment due: 07/31/2026. Contract renewal deadline: September 30, 2026. Budget approval needed before end of October."

export default function UploadPanel({ onExtract }: Props) {
  const [pdfDrag, setPdfDrag] = useState(false)
  const [imgDrag, setImgDrag] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [imgFile, setImgFile] = useState<File | null>(null)
  const [pastedText, setPastedText] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      const deadlines = await fetchDeadlines(pdfFile, imgFile, pastedText || undefined)
      onExtract(deadlines)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const ZONE = (drag: boolean): React.CSSProperties => ({
    background: drag ? '#f0ece6' : '#faf8f4',
    border: `1.5px dashed ${drag ? '#999' : '#d4cec6'}`,
    borderRadius: '12px',
    transition: 'all 0.15s ease',
    cursor: 'pointer',
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
            label: 'PDF document', emoji: '📄', drag: pdfDrag, fileName: pdfFile?.name ?? null,
            ref: pdfRef, accept: '.pdf',
            onDragOver: () => setPdfDrag(true), onDragLeave: () => setPdfDrag(false),
            onDrop: (e: React.DragEvent) => { e.preventDefault(); setPdfDrag(false); const f = e.dataTransfer.files[0]; if (f) handleDrop(f, 'pdf') },
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleDrop(f, 'pdf') },
          },
          {
            label: 'Screenshot', emoji: '🖼️', drag: imgDrag, fileName: imgFile?.name ?? null,
            ref: imgRef, accept: 'image/*',
            onDragOver: () => setImgDrag(true), onDragLeave: () => setImgDrag(false),
            onDrop: (e: React.DragEvent) => { e.preventDefault(); setImgDrag(false); const f = e.dataTransfer.files[0]; if (f) handleDrop(f, 'img') },
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleDrop(f, 'img') },
          },
        ].map((z) => (
          <div
            key={z.label}
            style={ZONE(z.drag)}
            className="flex flex-col items-center justify-center gap-2 py-8 select-none"
            onClick={() => z.ref.current?.click()}
            onDragOver={(e) => { e.preventDefault(); z.onDragOver() }}
            onDragLeave={z.onDragLeave}
            onDrop={z.onDrop}
          >
            <span className="text-2xl">{z.emoji}</span>
            <div className="text-center">
              <p className="text-xs font-medium" style={{ color: '#444', fontFamily: SANS }}>
                {z.fileName ?? z.label}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: '#bbb', fontFamily: SANS }}>Click or drag & drop</p>
            </div>
            <input ref={z.ref} type="file" accept={z.accept} className="hidden" onChange={z.onChange} />
          </div>
        ))}
      </div>

      {/* Paste toggle */}
      <div className="mb-4">
        <button
          className="text-xs transition-colors"
          style={{ color: '#bbb', fontFamily: SANS }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#555')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#bbb')}
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

      {/* Example */}
      {!canExtract && (
        <button
          className="text-[11px] mb-3 block transition-colors"
          style={{ color: '#ccc', fontFamily: SANS }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#888')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#ccc')}
          onClick={() => { setPastedText(EXAMPLE); setShowPaste(true) }}
        >
          ↗ load example
        </button>
      )}

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
    </div>
  )
}
