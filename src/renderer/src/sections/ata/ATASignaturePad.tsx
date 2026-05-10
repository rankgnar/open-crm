import { useState, useRef, useEffect } from 'react'
import { X, Eraser } from 'lucide-react'

interface Props {
  onSign: (godkand_av: string, signatur_data: string) => Promise<void>
  onCancel: () => void
}

export function ATASignaturePad({ onSign, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastRef = useRef<{ x: number; y: number } | null>(null)
  const [hasInk, setHasInk] = useState(false)
  const [namn, setNamn] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#ffffff'
  }, [])

  function pointFromEvent(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const t = e.touches[0] ?? e.changedTouches[0]
      if (!t) return null
      return { x: t.clientX - rect.left, y: t.clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const p = pointFromEvent(e)
    if (!p) return
    drawingRef.current = true
    lastRef.current = p
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawingRef.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const p = pointFromEvent(e)
    if (!p || !lastRef.current) return
    ctx.beginPath()
    ctx.moveTo(lastRef.current.x, lastRef.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    lastRef.current = p
    if (!hasInk) setHasInk(true)
  }

  function end() {
    drawingRef.current = false
    lastRef.current = null
  }

  function clear() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
  }

  async function handleSubmit() {
    if (!namn.trim()) { setError('Ange namn'); return }
    if (!hasInk) { setError('Signera först'); return }
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    setSubmitting(true)
    setError('')
    try {
      await onSign(namn.trim(), dataUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara signaturen')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg border border-border rounded-xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar">
          <h2 className="text-sm font-medium text-fg">Signera ÄTA</h2>
          <button onClick={onCancel} className="text-muted hover:text-fg transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted">Godkännarens namn</label>
            <input
              type="text"
              className="input"
              value={namn}
              onChange={(e) => setNamn(e.target.value)}
              placeholder="För- och efternamn"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted">Signatur</label>
              <button
                onClick={clear}
                disabled={!hasInk}
                className="flex items-center gap-1 text-[11px] text-muted hover:text-fg transition-colors disabled:opacity-30"
              >
                <Eraser size={11} />Rensa
              </button>
            </div>
            <canvas
              ref={canvasRef}
              className="w-full h-48 bg-elevated border border-border rounded-md cursor-crosshair touch-none"
              onMouseDown={start}
              onMouseMove={move}
              onMouseUp={end}
              onMouseLeave={end}
              onTouchStart={start}
              onTouchMove={move}
              onTouchEnd={end}
            />
            <p className="text-[11px] text-subtle">Skriv med musen eller fingret/pekpennan på en surfplatta</p>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-border bg-sidebar">
          <button onClick={onCancel} className="text-sm text-muted hover:text-fg transition-colors px-3 py-1.5">
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !namn.trim() || !hasInk}
            className="rounded-md bg-fg text-bg px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            {submitting ? 'Sparar...' : 'Bekräfta godkännande'}
          </button>
        </div>
      </div>
    </div>
  )
}
