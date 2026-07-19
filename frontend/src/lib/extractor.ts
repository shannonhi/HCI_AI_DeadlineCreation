export type Urgency = 'overdue' | 'today' | 'this-week' | 'upcoming'

export type DateFormatReason = 'forced' | 'inferred' | 'assumed' | 'conflicting' | null

export interface Deadline {
  id: string
  text: string
  date: Date
  rawDate: string
  urgency: Urgency
  context: string
  dateEstimated: boolean
  dateFormatAmbiguous: boolean
  dateFormatReason: DateFormatReason
}

interface BackendDeadline {
  title: string
  date: string   // YYYY-MM-DD
  time: string   // HH:MM
  description: string
  date_estimated?: boolean
  date_format_ambiguous?: boolean
  date_format_reason?: DateFormatReason
}

export function getUrgency(date: Date): Urgency {
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
    dateEstimated: !!bd.date_estimated,
    dateFormatAmbiguous: !!bd.date_format_ambiguous,
    dateFormatReason: bd.date_format_reason ?? null,
  }
}

export interface UnresolvedItem {
  title: string
  description: string
}

export interface ExtractResult {
  deadlines: Deadline[]
  unresolved: UnresolvedItem[]
  unreadableImage: boolean
}

export async function fetchDeadlines(
  pdf?: File | null,
  screenshot?: File | null,
  text?: string,
): Promise<ExtractResult> {
  const form = new FormData()
  if (pdf) form.append('pdf', pdf)
  if (screenshot) form.append('screenshot', screenshot)
  if (text) form.append('text', text)

  const res = await fetch('/api/extract', { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Extraction failed')
  }
  const data: {
    deadlines: BackendDeadline[]
    unresolved?: UnresolvedItem[]
    unreadable_image?: boolean
  } = await res.json()
  return {
    deadlines: data.deadlines.map(mapBackendDeadline).sort((a, b) => a.date.getTime() - b.date.getTime()),
    unresolved: data.unresolved ?? [],
    unreadableImage: !!data.unreadable_image,
  }
}

export function makeManualDeadline(title: string, dateStr: string): Deadline {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: title,
    date,
    rawDate: dateStr,
    urgency: getUrgency(date),
    context: 'Added manually',
    dateEstimated: false,
    dateFormatAmbiguous: false,
    dateFormatReason: null,
  }
}

export function withUpdatedDate(deadline: Deadline, dateStr: string): Deadline {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return {
    ...deadline,
    date,
    rawDate: dateStr,
    urgency: getUrgency(date),
    dateEstimated: false,
    dateFormatAmbiguous: false,
    dateFormatReason: null,
  }
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
