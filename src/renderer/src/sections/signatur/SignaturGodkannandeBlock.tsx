interface Props {
  godkand_av: string | null
  godkand_datum: string | null
  signatur_data: string | null
}

export function SignaturGodkannandeBlock({ godkand_av, godkand_datum, signatur_data }: Props) {
  if (!signatur_data && !godkand_av) return null

  return (
    <div className="px-4 py-4 border-t border-border">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Godkännande</p>

      <div className="flex flex-col gap-3 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-subtle">Godkänd av</span>
          <span className="text-fg">{godkand_av || '—'}</span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-subtle">Datum</span>
          <span className="text-fg">{godkand_datum ? godkand_datum.slice(0, 10) : '—'}</span>
        </div>

        {signatur_data && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-subtle">Signatur</span>
            <div className="bg-white border border-border rounded-md p-2">
              <img src={signatur_data} alt="Signatur" className="h-20 w-auto" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
