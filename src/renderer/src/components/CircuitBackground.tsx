import { useEffect, useRef, useCallback } from 'react'

interface Point { x: number; y: number }
interface Pulse { id: number; from: number; to: number; progress: number; speed: number; waveId: number }

interface Props { theme: 'dark' | 'light' }

const GRID = 48
const JITTER = 14
const MAX_DIST = 80
// Fast enough to cross ~47 hops (screen diagonal) in ~1.8s at 60fps
const PULSE_SPEED = 0.4
const EDGE_DECAY = 0.007   // edge glow lasts ~2.4s after pulse passes
const NODE_DECAY = 0.018   // node glow lasts ~1s
const SPAWN_MS = 2200
const MAX_PULSES = 1200    // high limit — no per-pulse drawing cost

let _pid = 0, _wid = 0

const edgeKey = (i: number, j: number): number => i < j ? i * 10000 + j : j * 10000 + i

function makePoints(w: number, h: number): Point[] {
  const pts: Point[] = []
  for (let r = 0; r <= Math.ceil(h / GRID); r++)
    for (let c = 0; c <= Math.ceil(w / GRID); c++)
      pts.push({ x: c * GRID + (Math.random() - 0.5) * 2 * JITTER, y: r * GRID + (Math.random() - 0.5) * 2 * JITTER })
  return pts
}

function makeAdj(pts: Point[]): number[][] {
  return pts.map((p, i) =>
    pts.reduce<number[]>((acc, q, j) => {
      if (j !== i) {
        const dx = p.x - q.x, dy = p.y - q.y
        if (dx * dx + dy * dy < MAX_DIST * MAX_DIST) acc.push(j)
      }
      return acc
    }, [])
  )
}

function makeBg(pts: Point[], adj: number[][], w: number, h: number, dark: boolean): HTMLCanvasElement {
  const bg = document.createElement('canvas')
  bg.width = w; bg.height = h
  const ctx = bg.getContext('2d')!
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'
  ctx.lineWidth = 1
  for (let i = 0; i < pts.length; i++)
    for (const j of adj[i])
      if (j > i) { ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke() }
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2); ctx.fill() }
  return bg
}

function centerNode(pts: Point[], w: number, h: number): number {
  const cx = w / 2, cy = h / 2
  let best = 0, bestD = Infinity
  for (let i = 0; i < pts.length; i++) {
    const d = (pts[i].x - cx) ** 2 + (pts[i].y - cy) ** 2
    if (d < bestD) { best = i; bestD = d }
  }
  return best
}

export function CircuitBackground({ theme }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const themeRef = useRef(theme)
  themeRef.current = theme

  const S = useRef({
    pts: [] as Point[],
    adj: [] as number[][],
    bg: null as HTMLCanvasElement | null,
    pulses: [] as Pulse[],
    nodeGlows: [] as number[],
    edgeGlows: new Map<number, number>(),
    waveVisited: new Map<number, Set<number>>(),
    lastSpawn: -SPAWN_MS,
    raf: 0,
    waveCount: 0,
  })

  const spawnWave = useCallback((src: number) => {
    const { pts, adj, pulses, waveVisited, nodeGlows } = S.current
    if (!pts.length) return
    const waveId = _wid++
    const visited = new Set<number>([src])
    waveVisited.set(waveId, visited)
    nodeGlows[src] = 1
    for (const nb of adj[src]) {
      if (pulses.length < MAX_PULSES) {
        visited.add(nb)
        pulses.push({ id: _pid++, from: src, to: nb, progress: 0, speed: PULSE_SPEED * (0.85 + Math.random() * 0.3), waveId })
      }
    }
    S.current.waveCount++
  }, [])

  const setup = useCallback((w: number, h: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = w; canvas.height = h
    const dark = themeRef.current === 'dark'
    const pts = makePoints(w, h)
    const adj = makeAdj(pts)
    S.current = {
      ...S.current,
      pts, adj,
      bg: makeBg(pts, adj, w, h, dark),
      pulses: [],
      nodeGlows: new Array(pts.length).fill(0),
      edgeGlows: new Map(),
      waveVisited: new Map(),
      lastSpawn: -SPAWN_MS,
      waveCount: 0,
    }
  }, [])

  useEffect(() => {
    const { pts, adj, bg } = S.current
    if (!bg || !pts.length) return
    S.current.bg = makeBg(pts, adj, bg.width, bg.height, theme === 'dark')
  }, [theme])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas?.parentElement) return
    const ro = new ResizeObserver(entries => {
      const r = entries[0]
      if (r) setup(Math.floor(r.contentRect.width), Math.floor(r.contentRect.height))
    })
    ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [setup])

  useEffect(() => {
    const loop = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const { pts, adj, bg, pulses, nodeGlows, edgeGlows, waveVisited } = S.current
      const { width: W, height: H } = canvas
      const now = performance.now()

      // Spawn wave: first always from center, then random
      if (now - S.current.lastSpawn > SPAWN_MS && pts.length) {
        S.current.lastSpawn = now
        const src = S.current.waveCount === 0 ? centerNode(pts, W, H) : Math.floor(Math.random() * pts.length)
        spawnWave(src)
      }

      ctx.clearRect(0, 0, W, H)
      if (bg) ctx.drawImage(bg, 0, 0)

      const dark = themeRef.current === 'dark'
      const glowRgb = dark ? '74,222,128' : '59,130,246'
      const glowHex = dark ? '#4ade80' : '#3b82f6'

      // Batched: glowing edges
      ctx.save()
      ctx.lineWidth = 1
      ctx.shadowBlur = 0
      ctx.shadowColor = glowHex
      for (const [key, intensity] of edgeGlows) {
        const next = intensity - EDGE_DECAY
        if (next < 0.01) { edgeGlows.delete(key); continue }
        edgeGlows.set(key, next)
        const i = Math.floor(key / 10000), j = key % 10000
        ctx.strokeStyle = `rgba(${glowRgb},${intensity * (dark ? 0.12 : 0.13)})`
        ctx.beginPath()
        ctx.moveTo(pts[i].x, pts[i].y)
        ctx.lineTo(pts[j].x, pts[j].y)
        ctx.stroke()
      }
      ctx.restore()

      // Batched: glowing nodes
      ctx.save()
      ctx.shadowBlur = 4
      ctx.shadowColor = glowHex
      for (let i = 0; i < pts.length; i++) {
        const g = nodeGlows[i]
        if (g < 0.01) { nodeGlows[i] = 0; continue }
        ctx.fillStyle = `rgba(${glowRgb},${g * (dark ? 0.22 : 0.20)})`
        ctx.beginPath()
        ctx.arc(pts[i].x, pts[i].y, 2, 0, Math.PI * 2)
        ctx.fill()
        nodeGlows[i] -= NODE_DECAY
      }
      ctx.restore()

      // Advance pulses — no dot rendering, visual is edge + node glows
      const done: number[] = []
      for (let i = 0; i < pulses.length; i++) {
        const p = pulses[i]
        p.progress += p.speed
        // Keep edge lit while pulse traverses it
        const ek = edgeKey(p.from, p.to)
        edgeGlows.set(ek, Math.min(1, (edgeGlows.get(ek) ?? 0) + 0.5))

        if (p.progress >= 1) {
          done.push(i)
          // Activate destination node
          nodeGlows[p.to] = Math.min(1, nodeGlows[p.to] + 0.9)
          // BFS cascade: only visit unvisited nodes in this wave
          const visited = waveVisited.get(p.waveId)
          if (visited) {
            for (const nb of adj[p.to]) {
              if (!visited.has(nb) && pulses.length < MAX_PULSES) {
                visited.add(nb)
                pulses.push({ id: _pid++, from: p.to, to: nb, progress: 0, speed: PULSE_SPEED * (0.85 + Math.random() * 0.3), waveId: p.waveId })
              }
            }
          }
        }
      }
      for (let i = done.length - 1; i >= 0; i--) pulses.splice(done[i], 1)

      // Clean finished waves
      for (const [wid] of waveVisited)
        if (!pulses.some(p => p.waveId === wid)) waveVisited.delete(wid)

      S.current.raf = requestAnimationFrame(loop)
    }
    S.current.raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(S.current.raf)
  }, [spawnWave])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
}
