import { Sparkles } from 'lucide-react'

export function AIPanel() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-8 py-16">
      <Sparkles size={28} className="text-subtle" />
      <p className="text-sm font-medium text-muted">AI-modeller</p>
      <p className="text-xs text-subtle max-w-xs">Ingen AI-integration är konfigurerad ännu. Kommer snart.</p>
    </div>
  )
}
