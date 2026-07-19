import { useState } from 'react'
import notepadImg from './imports/Gemini_Generated_Image_2g9oi02g9oi02g9o-removebg-preview.png'
import calendarImg from './imports/18235a6cd8acc6a6e5e6f6869f874cde-removebg-preview.png'
import clockImg from './imports/79ef47f7a05fb451cf3e19fada179e34-removebg-preview.png'
import postItYellow from './imports/Screenshot_2026-07-12_002630-removebg-preview.png'
import postItPink from './imports/Screenshot_2026-07-12_002646-removebg-preview.png'
import UploadPanel from './components/UploadPanel'
import ResultsPanel from './components/ResultsPanel'
import { withUpdatedDate, type Deadline } from './lib/extractor'

const SERIF = "'DM Serif Display', Georgia, serif"

export default function App() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [extracted, setExtracted] = useState(false)

  const handleExtract = (results: Deadline[]) => {
    setDeadlines(results)
    setExtracted(true)
  }

  const handleRename = (id: string, newText: string) => {
    setDeadlines((prev) => prev.map((d) => (d.id === id ? { ...d, text: newText } : d)))
  }

  const handleDateChange = (id: string, newDateStr: string) => {
    setDeadlines((prev) => prev.map((d) => (d.id === id ? withUpdatedDate(d, newDateStr) : d)))
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#f7f5f0' }}>

      {/* Floating decorative cards */}
      <FloatingCards />

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 pt-10 pb-12">
        <h1 className="leading-none mb-4 max-w-xl" style={{ fontFamily: SERIF }}>
          <span className="block" style={{ fontSize: 'clamp(3rem, 8vw, 5.5rem)', color: '#1a1a1a', letterSpacing: '-0.02em' }}>
            Find every
          </span>
          <span className="block italic" style={{ fontSize: 'clamp(3rem, 8vw, 5.5rem)', color: '#1a1a1a', letterSpacing: '-0.02em' }}>
            deadline
          </span>
          <span className="block" style={{ fontSize: 'clamp(3rem, 8vw, 5.5rem)', color: '#1a1a1a', letterSpacing: '-0.02em' }}>
            instantly.
          </span>
        </h1>
        <p className="text-base mb-10 max-w-xs leading-relaxed" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", color: '#888', fontWeight: 700, letterSpacing: '-0.04em', textTransform: 'lowercase' }}>
          Paste text or upload a document. Extract every date into a calendar-ready file.
        </p>

        {/* Main card */}
        <div className="w-full max-w-lg">
          {!extracted ? (
            <UploadPanel onExtract={handleExtract} />
          ) : (
            <ResultsPanel
              deadlines={deadlines}
              onReset={() => { setExtracted(false); setDeadlines([]) }}
              onRename={handleRename}
              onDateChange={handleDateChange}
            />
          )}
        </div>
      </div>
    </div>
  )
}


function FloatingCards() {
  return (
    <>
      <img
        src={postItYellow}
        alt="Yellow post-it note"
        className="absolute hidden lg:block select-none pointer-events-none"
        style={{ top: '6%', left: '9%', width: '200px', transform: 'rotate(-6deg)', filter: 'drop-shadow(2px 5px 14px rgba(0,0,0,0.12))', zIndex: 2 }}
      />
      <img
        src={postItPink}
        alt="Pink post-it note"
        className="absolute hidden lg:block select-none pointer-events-none"
        style={{ top: '22%', left: '19%', width: '200px', transform: 'rotate(4deg)', filter: 'drop-shadow(2px 5px 14px rgba(0,0,0,0.10))', zIndex: 1 }}
      />
      <img
        src={clockImg}
        alt="Alarm clock"
        className="absolute hidden lg:block select-none pointer-events-none"
        style={{ top: '8%', right: '13%', width: '210px', transform: 'rotate(6deg)', filter: 'drop-shadow(2px 6px 18px rgba(0,0,0,0.12))', zIndex: 1 }}
      />
      <img
        src={notepadImg}
        alt="Notepad with scribbles"
        className="absolute hidden lg:block select-none pointer-events-none"
        style={{ bottom: '10%', left: '9%', width: '300px', transform: 'rotate(-6deg)', filter: 'drop-shadow(2px 6px 18px rgba(0,0,0,0.12))', zIndex: 1 }}
      />
      <img
        src={calendarImg}
        alt="Desk calendar"
        className="absolute hidden lg:block select-none pointer-events-none"
        style={{ bottom: '12%', right: '12%', width: '220px', transform: 'rotate(-4deg)', filter: 'drop-shadow(2px 6px 18px rgba(0,0,0,0.10))', zIndex: 1 }}
      />
    </>
  )
}
