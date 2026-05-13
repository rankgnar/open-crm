import { useState, useEffect, useCallback } from 'react'
import { Check, Save, FileDown } from 'lucide-react'
import { useAppConfig } from '@/context/AppConfig'
import { Toggle } from '@/components/Toggle'
import type { PdfMall } from '../types'
import { DEFAULT_FORSLAG_HTML } from '@/pdf/defaultTemplates'
import { DEFAULT_ORDER_HTML, buildOrderRaderHtml } from '@/pdf/defaultOrderTemplate'
import { buildForslagDesglose } from '@/pdf/buildForslagDesglose'
import { injectVars } from '@/pdf/inject'

type Tab = 'forslag' | 'order'

const TAB_META: Record<Tab, { label: string; defaultMall: Omit<PdfMall, 'id' | 'skapad_at' | 'uppdaterad_at'> }> = {
  forslag: {
    label: 'Förslag',
    defaultMall: {
      typ: 'forslag',
      namn: 'Förslag',
      accent_farg: '#1B3A6B',
      portada_titel: 'FÖRSLAG',
      portada_titel_2: '',
      portada_undertitel: 'Sammanställning av arbete och material',
      visa_portada: true,
      visa_sammanfattning: true,
      visa_schema: false,
      visa_tidplan: false,
      visa_arbetskostnad: true,
      visa_materialkostnad: true,
      visa_godkand_f_skatt: true,
      visa_leverantor_material: true,
      visa_fas_notat: true,
      visa_villkor: true,
      html_mall: '',
    },
  },
  order: {
    label: 'Order',
    defaultMall: {
      typ: 'order',
      namn: 'Order',
      accent_farg: '#1B3A6B',
      portada_titel: '',
      portada_titel_2: '',
      portada_undertitel: '',
      visa_portada: false,
      visa_sammanfattning: false,
      visa_schema: false,
      visa_tidplan: false,
      visa_arbetskostnad: false,
      visa_materialkostnad: false,
      visa_godkand_f_skatt: true,
      visa_leverantor_material: false,
      visa_fas_notat: true,
      visa_villkor: false,
      html_mall: '',
    },
  },
}

const ACCENT_PRESETS = [
  { label: 'Navy',    value: '#1B3A6B' },
  { label: 'Mörk',   value: '#0f172b' },
  { label: 'Blå',    value: '#1a5276' },
  { label: 'Grön',   value: '#145a32' },
  { label: 'Brun',   value: '#6e2f1a' },
  { label: 'Röd',    value: '#7b1a1a' },
  { label: 'Guld',   value: '#b7860d' },
  { label: 'Grå',    value: '#374151' },
]

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border">
      <div className="min-w-0">
        <p className="text-sm text-fg">{label}</p>
        {description && <p className="text-[11px] text-muted mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Field({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="py-3 border-b border-border">
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-sm text-fg">{label}</p>
        {description && <p className="text-[11px] text-muted">{description}</p>}
      </div>
      {children}
    </div>
  )
}

export function PDFsPanel() {
  const { config } = useAppConfig()
  const [tab, setTab] = useState<Tab>('forslag')
  const [mall, setMall] = useState<Partial<PdfMall>>(TAB_META.forslag.defaultMall)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  const loadMall = useCallback(async (target: Tab) => {
    const data = await window.api.invoke('db:pdf-mall:list') as PdfMall[]
    const found = data.find((m) => m.typ === target)
    setMall(found ?? TAB_META[target].defaultMall)
  }, [])

  useEffect(() => { void loadMall(tab) }, [tab, loadMall])

  function set<K extends keyof PdfMall>(key: K, value: PdfMall[K]) {
    setMall((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const updated = await window.api.invoke('db:pdf-mall:upsert', mall) as PdfMall
    setMall(updated)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handlePreview() {
    setPreviewing(true)
    try {
      if (tab === 'forslag') await previewForslag()
      else await previewOrder()
    } finally {
      setPreviewing(false)
    }
  }

  async function previewForslag() {
    const template = (mall.html_mall && mall.html_mall.trim() !== '') ? mall.html_mall : DEFAULT_FORSLAG_HTML
    const mockDesglose = buildForslagDesglose(
      [{ id: 'f1', forslag_id: 'x', namn: 'Projektering', beskrivning: null, sortering: 0, start_datum: null, slut_datum: null, notat: null, skapad_at: '' }],
      { f1: [{ id: 's1', fas_id: 'f1', namn: 'Ritningar', beskrivning: null, sortering: 0, skapad_at: '' }] },
      { s1: [{ id: 'a1', subfas_id: 's1', beskrivning: 'Projekteringsarbete', yrkesroll: 'Projektledare', antal_timmar: 20, timpris: 950, rot_berattigad: true, skapad_at: '' }] },
      { s1: [{ id: 'm1', subfas_id: 's1', beskrivning: 'Ritningspapper A1', enhet: 'st', antal: 10, a_pris: 85, leverantor: 'Contex', skapad_at: '' }] },
      {},
      { momsProcent: 25, rotAvdrag: true, rotProcent: 30, rotInkluderaMedsokande: false, rotCapEnkel: config?.rot_avdrag_tak_enkel ?? 50000, rotCapDubbel: config?.rot_avdrag_tak_dubbel ?? 100000, accentFarg: mall.accent_farg ?? '#1B3A6B', visaLeverantor: mall.visa_leverantor_material !== false }
    )
    const fmt = (n: number) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n))
    const logoHtml = config?.foretag_logo_url
      ? `<img src="${config.foretag_logo_url}" style="max-height:50px;max-width:160px;object-fit:contain;" />`
      : `<div class="cover-logo">${config?.foretag_namn ?? 'Företaget AB'}</div>`
    const vars: Record<string, string> = {
      foretag_namn: config?.foretag_namn ?? 'Företaget AB',
      foretag_org_nummer: config?.foretag_org_nummer ?? '000000-0000',
      foretag_telefon: config?.foretag_telefon ?? '+46 70 000 00 00',
      foretag_email: config?.foretag_email ?? 'info@foretaget.se',
      foretag_webbadress: config?.foretag_webbadress ?? 'www.foretaget.se',
      accent_farg: mall.accent_farg ?? '#1B3A6B',
      portada_titel: mall.portada_titel || 'FÖRSLAG',
      portada_undertitel: mall.portada_undertitel || 'Sammanställning av arbete och material',
      visa_portada_display: mall.visa_portada !== false ? 'flex' : 'none',
      visa_sammanfattning_display: mall.visa_sammanfattning !== false ? 'flex' : 'none',
      visa_villkor_display: mall.visa_villkor !== false ? 'block' : 'none',
      projekt_villkor: 'Betalning sker inom 30 dagar från fakturadatum. Vid försenad betalning tillkommer dröjsmålsränta.',
      visa_godkand_fskatt_html: mall.visa_godkand_f_skatt !== false ? '<div class="cover-company-line">Godkänd för F-skatt</div>' : '',
      visa_godkand_fskatt_text: mall.visa_godkand_f_skatt !== false ? ' &nbsp;·&nbsp; Godkänd för F-skatt' : '',
      logo_html: logoHtml,
      kund_namn: 'Anna Svensson',
      projekt_namn: 'Renovering kök och badrum',
      adress: 'Hornsgatan 45, Stockholm',
      datum: new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' }),
      giltighet: '30 dagar',
      arbetskostnad: fmt(19000),
      materialkostnad: fmt(850),
      total_ue: fmt(0),
      netto_exkl_moms: fmt(19850),
      rot_avdrag: fmt(5700),
      rot_procent_text: '30',
      netto_efter_rot: fmt(14150),
      moms_procent_text: '25',
      moms_belopp: fmt(3538),
      offertvarde: fmt(17688),
      offertvarde_efter_rot: fmt(17688),
      valuta: 'kr',
      desglose_html: mockDesglose,
    }
    const html = injectVars(template, vars)
    await window.api.invoke('pdf:generate-html', { html, name: 'forslag-preview', save: false })
  }

  async function previewOrder() {
    const template = (mall.html_mall && mall.html_mall.trim() !== '') ? mall.html_mall : DEFAULT_ORDER_HTML
    const mockRader = [
      { beskrivning: 'Extra kakling badrum', antal: 6.5, enhet: 'm²', a_pris: 850, belopp: 5525 },
      { beskrivning: 'Materialkostnad — kakelplattor', antal: 7, enhet: 'm²', a_pris: 320, belopp: 2240 },
    ]
    const fmt = (n: number) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n))
    const netto = mockRader.reduce((s, r) => s + r.belopp, 0)
    const moms = Math.round(netto * 0.25)
    const total = netto + moms
    const logoHtml = config?.foretag_logo_url
      ? `<img src="${config.foretag_logo_url}" style="max-height:50px;max-width:160px;object-fit:contain;" />`
      : `<div class="cover-logo">${config?.foretag_namn ?? 'Företaget AB'}</div>`
    const vars: Record<string, string> = {
      foretag_namn: config?.foretag_namn ?? 'Företaget AB',
      foretag_org_nummer: config?.foretag_org_nummer ?? '000000-0000',
      foretag_telefon: config?.foretag_telefon ?? '+46 70 000 00 00',
      foretag_email: config?.foretag_email ?? 'info@foretaget.se',
      foretag_webbadress: config?.foretag_webbadress ?? 'www.foretaget.se',
      accent_farg: mall.accent_farg ?? '#1B3A6B',
      visa_villkor_display: mall.visa_villkor !== false ? 'block' : 'none',
      visa_beskrivning_display: 'block',
      visa_godkand_fskatt_text: mall.visa_godkand_f_skatt !== false ? ' &nbsp;·&nbsp; Godkänd för F-skatt' : '',
      villkor_text: 'Order är gällande efter signering av kund. Arbetet faktureras separat från huvudprojekt.',
      logo_html: logoHtml,
      order_nummer: 'O-0001',
      titel: 'Tilläggsarbete: kakling badrum',
      kund_namn: 'Anna Svensson',
      kund_org_nr: '880101-1234',
      projekt_namn: 'Renovering kök och badrum',
      fas_namn: 'Badrum',
      subfas_namn: 'Kakling',
      datum: new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' }),
      beskrivning: 'Kund vill utöka kaklingen till hela badrummet istället för enbart våtzon enligt ursprunglig offert.',
      rader_html: buildOrderRaderHtml(mockRader, 'kr'),
      netto: fmt(netto),
      moms: fmt(moms),
      total: fmt(total),
      valuta: 'kr',
      signatur_img_html: '<div style="font-size:10px;color:#888;font-style:italic;padding:20px 0;">[ Signaturbild visas här om ordern är godkänd ]</div>',
      godkand_av: 'Anna Svensson',
      godkand_datum: new Date().toLocaleDateString('sv-SE'),
    }
    const html = injectVars(template, vars)
    await window.api.invoke('pdf:generate-html', { html, name: 'order-preview', save: false })
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6">

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-border">
          {(Object.keys(TAB_META) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${tab === t ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg'}`}
            >
              {TAB_META[t].label}
            </button>
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted">PDF-konfiguration</p>
            <h3 className="text-base font-semibold text-fg mt-0.5">{TAB_META[tab].label}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreview}
              disabled={previewing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border text-muted rounded hover:text-fg hover:bg-hover transition-colors disabled:opacity-50"
            >
              <FileDown size={12} />
              {previewing ? 'Genererar...' : 'Förhandsgranska'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border text-muted rounded hover:text-fg hover:bg-hover transition-colors disabled:opacity-50"
            >
              {saved ? (
                <><Check size={12} className="text-emerald-400" /><span className="text-emerald-400">Sparat</span></>
              ) : (
                <><Save size={12} />{saving ? 'Sparar...' : 'Spara'}</>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-10">

          {/* COL 1 — Portada + Utseende */}
          <div>
            {tab === 'forslag' && (
              <>
                <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Portada</p>
                <Row label="Visa portada" description="Mörk framsida med sammanfattning">
                  <Toggle checked={mall.visa_portada !== false} onChange={(v) => set('visa_portada', v)} />
                </Row>
                <div className={`transition-opacity ${mall.visa_portada === false ? 'opacity-40 pointer-events-none' : ''}`}>
                  <Field label="Titel 1">
                    <input
                      value={mall.portada_titel ?? ''}
                      onChange={(e) => set('portada_titel', e.target.value)}
                      placeholder="FÖRSLAG"
                      className="w-full bg-elevated border border-border rounded px-2.5 py-1.5 text-sm text-fg outline-none focus:border-subtle"
                    />
                  </Field>
                  <Field label="Titel 2" description="Valfri — val vid PDF-export">
                    <input
                      value={mall.portada_titel_2 ?? ''}
                      onChange={(e) => set('portada_titel_2', e.target.value)}
                      placeholder="T.ex. OFFERT"
                      className="w-full bg-elevated border border-border rounded px-2.5 py-1.5 text-sm text-fg outline-none focus:border-subtle"
                    />
                  </Field>
                  <Field label="Undertitel">
                    <input
                      value={mall.portada_undertitel ?? ''}
                      onChange={(e) => set('portada_undertitel', e.target.value)}
                      placeholder="Sammanställning av arbete och material"
                      className="w-full bg-elevated border border-border rounded px-2.5 py-1.5 text-sm text-fg outline-none focus:border-subtle"
                    />
                  </Field>
                </div>
              </>
            )}

            <p className={`text-[10px] uppercase tracking-widest text-muted mb-1 ${tab === 'forslag' ? 'mt-6' : ''}`}>Utseende</p>
            <Field label="Accentfärg" description="Header, tabeller och totaler">
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex gap-1.5">
                  {ACCENT_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      title={p.label}
                      onClick={() => set('accent_farg', p.value)}
                      className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${mall.accent_farg === p.value ? 'border-fg scale-110' : 'border-transparent'}`}
                      style={{ background: p.value }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={mall.accent_farg ?? '#1B3A6B'}
                  onChange={(e) => set('accent_farg', e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent"
                  title="Välj valfri färg"
                />
              </div>
            </Field>
            <Field label="Logotyp" description="Hanteras centralt i Företagsinformation">
              <div className="flex items-center gap-2 mt-0.5">
                {config?.foretag_logo_url ? (
                  <img src={config.foretag_logo_url} alt="Logo" className="h-7 max-w-[80px] object-contain rounded" />
                ) : (
                  <span className="text-xs text-subtle">Ingen logotyp uppladdad</span>
                )}
              </div>
            </Field>
          </div>

          {/* COL 2 — Innehåll */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Innehåll</p>
            {tab === 'forslag' ? (
              <>
                <Row label="Visa sammanfattningssida" description="Sida 2 med totaler och ROT-beräkning">
                  <Toggle checked={mall.visa_sammanfattning !== false} onChange={(v) => set('visa_sammanfattning', v)} />
                </Row>
                <Row label="Visa arbetskostnad" description="Inkludera arbetsrader i kostnadsspec">
                  <Toggle checked={mall.visa_arbetskostnad !== false} onChange={(v) => set('visa_arbetskostnad', v)} />
                </Row>
                <Row label="Visa materialkostnad" description="Inkludera materialrader i kostnadsspec">
                  <Toggle checked={mall.visa_materialkostnad !== false} onChange={(v) => set('visa_materialkostnad', v)} />
                </Row>
                <Row label="Inkludera tidplan" description="Bifoga tidplan vid export av förslag">
                  <Toggle checked={mall.visa_tidplan === true} onChange={(v) => set('visa_tidplan', v)} />
                </Row>
                <Row label="Visa leverantör på material" description="Leverantörskolumn i materialtabellen">
                  <Toggle checked={mall.visa_leverantor_material !== false} onChange={(v) => set('visa_leverantor_material', v)} />
                </Row>
                <Row label="Visa noteringar" description="Anmärkningar per fas i kostnadsspec">
                  <Toggle checked={mall.visa_fas_notat !== false} onChange={(v) => set('visa_fas_notat', v)} />
                </Row>
                <Row label="Godkänd för F-skatt" description="F-skatt-godkännande i header">
                  <Toggle checked={mall.visa_godkand_f_skatt !== false} onChange={(v) => set('visa_godkand_f_skatt', v)} />
                </Row>
                <Row label="Visa villkor" description="Projektets villkor på sammanfattningssidan">
                  <Toggle checked={mall.visa_villkor !== false} onChange={(v) => set('visa_villkor', v)} />
                </Row>
              </>
            ) : (
              <>
                <Row label="Godkänd för F-skatt" description="F-skatt-godkännande i header">
                  <Toggle checked={mall.visa_godkand_f_skatt !== false} onChange={(v) => set('visa_godkand_f_skatt', v)} />
                </Row>
                <Row label="Visa villkor" description="Allmänna villkor under signaturen">
                  <Toggle checked={mall.visa_villkor !== false} onChange={(v) => set('visa_villkor', v)} />
                </Row>
                <p className="text-[11px] text-subtle mt-3 leading-relaxed">
                  Signatur visas automatiskt när ordern är godkänd. Beskrivning, rader och totaler visas alltid.
                </p>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
