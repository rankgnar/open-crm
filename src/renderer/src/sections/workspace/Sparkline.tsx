interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  className?: string
  showDot?: boolean
}

export function Sparkline({ data, width = 120, height = 32, className = '', showDot = true }: SparklineProps) {
  if (data.length === 0) return <svg width={width} height={height} className={className} />

  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const stepX = data.length > 1 ? width / (data.length - 1) : 0

  const points = data.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * height
    return [x, y] as const
  })

  const path = points.reduce((acc, [x, y], i) => acc + (i === 0 ? `M${x},${y}` : ` L${x},${y}`), '')
  const last = points[points.length - 1]

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="ws-spark-path"
      />
      {showDot && last && (
        <circle cx={last[0]} cy={last[1]} r={2.5} fill="currentColor" />
      )}
    </svg>
  )
}
