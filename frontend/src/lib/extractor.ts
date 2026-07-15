export type Urgency = 'overdue' | 'today' | 'this-week' | 'upcoming'

export interface Deadline {
  id: string
  text: string
  date: Date
  rawDate: string
  urgency: Urgency
  context: string
}

interface BackendDeadline {
  title: string
  date: string   // YYYY-MM-DD
  time: string   // HH:MM
  description: string
}

function getUrgency(date: Date): Urgency {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = Math.floor((target.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 7) return 'this-week'
  return 'upcoming'
}

function mapBackendDeadline(bd: BackendDeadline, index: number): Deadline {
  const [year, month, day] = bd.date.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return {
    id: String(index),
    text: bd.title,
    date,
    rawDate: bd.date,
    urgency: getUrgency(date),
    context: bd.description,
  }
}

export async function fetchDeadlines(
  pdf?: File | null,
  screenshot?: File | null,
  text?: string,
): Promise<Deadline[]> {
  const form = new FormData()
  if (pdf) form.append('pdf', pdf)
  if (screenshot) form.append('screenshot', screenshot)
  if (text) form.append('text', text)

  const res = await fetch('/api/extract', { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Extraction failed')
  }
  const data: { deadlines: BackendDeadline[] } = await res.json()
  return data.deadlines.map(mapBackendDeadline)
}

export async function downloadIcs(deadlines: Deadline[]): Promise<void> {
  const body = deadlines.map((d) => ({
    title: d.text,
    date: d.rawDate,
    time: '23:59',
    description: d.context,
  }))

  const res = await fetch('/api/ics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'ICS export failed')
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'deadlines.ics'
  a.click()
  URL.revokeObjectURL(url)
}
