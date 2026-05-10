interface IcsEvent {
  id: string
  titel: string
  beskrivning?: string | null
  plats?: string | null
  start: string
  slut: string
  hel_dag?: boolean
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

export function buildIcs(calendarName: string, events: IcsEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//open-crm//Kalender//SV',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ]

  const stamp = formatDateTime(new Date().toISOString())

  for (const ev of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${ev.id}@open-crm`)
    lines.push(`DTSTAMP:${stamp}`)
    if (ev.hel_dag) {
      lines.push(`DTSTART;VALUE=DATE:${formatDate(ev.start)}`)
      lines.push(`DTEND;VALUE=DATE:${formatDate(ev.slut)}`)
    } else {
      lines.push(`DTSTART:${formatDateTime(ev.start)}`)
      lines.push(`DTEND:${formatDateTime(ev.slut)}`)
    }
    lines.push(`SUMMARY:${escapeText(ev.titel)}`)
    if (ev.beskrivning) lines.push(`DESCRIPTION:${escapeText(ev.beskrivning)}`)
    if (ev.plats) lines.push(`LOCATION:${escapeText(ev.plats)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
