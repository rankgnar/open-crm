import { useRef, useState } from 'react'

interface Props {
  html: string
  text?: string
}

export function EmailBody({ html, text = '' }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(200)

  function handleLoad() {
    const doc = iframeRef.current?.contentDocument
    if (doc) setHeight(doc.documentElement.scrollHeight + 16)
  }

  if (!html) {
    return <pre className="text-sm text-fg whitespace-pre-wrap font-sans px-6 py-5">{text || '(Inget innehåll)'}</pre>
  }

  const srcDoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body { margin: 0; padding: 16px; font-family: -apple-system, sans-serif; font-size: 14px; line-height: 1.5; }
    img { max-width: 100%; height: auto; }
    a { color: #60a5fa; }
  </style></head><body>${html}</body></html>`

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      onLoad={handleLoad}
      sandbox="allow-same-origin"
      className="w-full border-0"
      style={{ height, minHeight: 200 }}
      scrolling="no"
    />
  )
}
