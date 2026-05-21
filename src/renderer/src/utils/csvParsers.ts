export type ParsedRow = Record<string, string>

// Parses a CSV/semicolon-separated text file.
// Optional headerMap remaps column names; empty string = skip column.
export function parseCsv(text: string, headerMap?: Record<string, string>): ParsedRow[] {
  const t = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
  const lines = t.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const sep = lines[0].split(';').length > lines[0].split(',').length ? ';' : ','
  const rawHeaders = splitLine(lines[0], sep).map(h => h.trim().toLowerCase())
  const headers = headerMap ? rawHeaders.map(h => (h in headerMap ? headerMap[h] : h)) : rawHeaders
  return lines.slice(1).map(line => {
    const vals = splitLine(line, sep)
    const row: ParsedRow = {}
    headers.forEach((h, i) => { if (h) row[h] = (vals[i] ?? '').trim() })
    return row
  })
}

function splitLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = '', q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q }
    else if (c === sep && !q) { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}
