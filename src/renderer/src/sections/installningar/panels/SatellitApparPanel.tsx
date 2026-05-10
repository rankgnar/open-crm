import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Check, ExternalLink, GitBranch, Sparkles } from 'lucide-react'

interface SatelliteApp {
  id: string
  name: string
  purpose: string
  stack: string
  subdomain: string
  localPath: string
  framework: 'vite' | 'next'
  envExample: string
  repoUrl: string
  repoSlug: string
}

function openExternal(url: string): void {
  void window.api.invoke('shell:open-external', url)
}

const APPS: SatelliteApp[] = [
  {
    id: 'open-crm-app',
    name: 'open-crm-app',
    purpose: 'PWA för anställda — tidrapportering och frånvaro',
    stack: 'Vite 6 · React 18 · Tailwind v4',
    subdomain: 'app',
    localPath: '../open-crm-app',
    framework: 'vite',
    envExample: `VITE_SUPABASE_URL=https://<projekt>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>`,
    repoUrl: 'https://github.com/rankgnar/open-crm-app',
    repoSlug: 'rankgnar/open-crm-app',
  },
  {
    id: 'open-crm-client',
    name: 'open-crm-client',
    purpose: 'Kundportal — fakturor, offerter, dokument',
    stack: 'Next.js 16 · next-intl · React 19',
    subdomain: 'client',
    localPath: '../open-crm-client',
    framework: 'next',
    envExample: `NEXT_PUBLIC_SUPABASE_URL=https://<projekt>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>`,
    repoUrl: 'https://github.com/rankgnar/open-crm-client',
    repoSlug: 'rankgnar/open-crm-client',
  },
  {
    id: 'open-crm-remote',
    name: 'open-crm-remote',
    purpose: 'Mobil admin-PWA — CRM från fältet',
    stack: 'Vite 6 · React 18 · Tailwind v4',
    subdomain: 'remote',
    localPath: '../open-crm-remote',
    framework: 'vite',
    envExample: `VITE_SUPABASE_URL=https://<projekt>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>`,
    repoUrl: 'https://github.com/rankgnar/open-crm-remote',
    repoSlug: 'rankgnar/open-crm-remote',
  },
  {
    id: 'open-crm-sign',
    name: 'open-crm-sign',
    purpose: 'Elektronisk signering av PDF-dokument',
    stack: 'Vite 6 · React 18 · pdf-lib',
    subdomain: 'sign',
    localPath: '../open-crm-sign',
    framework: 'vite',
    envExample: `VITE_SUPABASE_URL=https://<projekt>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>`,
    repoUrl: 'https://github.com/rankgnar/open-crm-sign',
    repoSlug: 'rankgnar/open-crm-sign',
  },
]

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy(): void {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex items-start gap-2 bg-hover rounded-lg px-3 py-2.5">
      <pre className="font-mono text-xs text-fg flex-1 select-all whitespace-pre-wrap break-all">{text}</pre>
      <button
        onClick={handleCopy}
        className="shrink-0 p-1 rounded text-muted hover:text-fg transition-colors"
        title="Kopiera"
      >
        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      </button>
    </div>
  )
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs bg-hover px-1.5 py-0.5 rounded">{children}</span>
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-muted leading-relaxed">
      <span className="shrink-0 size-5 rounded-full bg-hover text-fg text-[11px] font-semibold flex items-center justify-center mt-0.5">{n}</span>
      <span>{children}</span>
    </li>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] uppercase tracking-wider text-muted">{children}</p>
}

function buildAiPrompt(app: SatelliteApp): string {
  return `I want to deploy "${app.name}" — part of the open-crm ecosystem — to Vercel under my own domain. Please walk me through the full process step by step, OR if you have shell access (e.g., Claude Code, Cursor agent), execute the steps yourself after asking me for the values you need.

App details:
- Repo: ${app.repoUrl}
- Stack: ${app.stack}
- Local path (if I already have the source): ${app.localPath}
- Target subdomain: ${app.subdomain}.<my-domain>  (replace <my-domain> with the actual root domain I will give you)
- Required environment variables:
${app.envExample.split('\n').map(line => '  ' + line).join('\n')}

What I need you to do:
1. Verify the Vercel CLI is installed; install it globally if missing (npm i -g vercel).
2. Help me authenticate with Vercel (vercel login).
3. From the local path (or after cloning the repo), run "vercel link" to create or link the project.
4. Add each environment variable to the Vercel project. ASK ME for the actual secret values one by one — never assume them, never log them in plaintext after I provide them.
5. Run the first production deploy (vercel --prod) and report the URL.
6. Help me add the custom subdomain in Vercel under Settings → Domains, and tell me the exact CNAME or A record I need to add at my DNS provider.
7. After DNS propagates, verify the deployment is reachable.

Rules:
- Ask clarifying questions BEFORE assuming any value: my Vercel scope/team, my Supabase project URL, my root domain.
- Show me each command before running it. Wait for my confirmation on anything destructive.
- Treat all Supabase keys and the SUPABASE_SERVICE_ROLE_KEY (if applicable) as secrets.
- If anything fails, diagnose the root cause — do not skip steps or paper over errors.

Begin by asking me the questions you need answered.`
}

function AppCard({ app }: { app: SatelliteApp }) {
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  const buildCmd = 'npm run build'
  const devCmd = 'npm run dev'
  const subdomainExample = `${app.subdomain}.<din-domän>`

  return (
    <div className="rounded-xl border border-border bg-elevated overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-hover transition-colors"
      >
        <div className="flex flex-col items-start gap-1 min-w-0">
          <p className="text-sm font-medium text-fg">{app.name}</p>
          <p className="text-xs text-muted text-left">{app.purpose}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="text-[11px] text-muted font-mono hidden sm:inline">{app.subdomain}.*</span>
          {open ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-border flex flex-col gap-5 pt-4">
          <div className="flex flex-col gap-2">
            <SectionTitle>Översikt</SectionTitle>
            <div className="flex flex-col gap-1.5 text-sm text-muted">
              <p>Stack: {app.stack}</p>
              <p>Lokal sökväg: <InlineCode>{app.localPath}</InlineCode></p>
              <p>Föreslagen subdomän: <InlineCode>{subdomainExample}</InlineCode></p>
              <div className="flex items-center gap-2">
                <GitBranch size={12} className="shrink-0" />
                <span>Källkod:</span>
                <button
                  onClick={() => openExternal(app.repoUrl)}
                  className="text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  {app.repoSlug}<ExternalLink size={10} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <SectionTitle>Kommandon</SectionTitle>
            <div className="flex flex-col gap-1.5 text-sm text-muted">
              <p>Utveckling: <InlineCode>{devCmd}</InlineCode></p>
              <p>Build: <InlineCode>{buildCmd}</InlineCode></p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <SectionTitle>Miljövariabler</SectionTitle>
            <CopyBlock text={app.envExample} />
            <p className="text-xs text-muted">
              Värdena hittar du i <InlineCode>Avancerat → DataBase</InlineCode>.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <SectionTitle>Deploya till Vercel</SectionTitle>
            <ol className="flex flex-col gap-2.5 mt-1">
              <Step n={1}>
                Klona repot om du inte redan har källkoden lokalt: <InlineCode>git clone {app.repoUrl}.git</InlineCode>. Annars: <InlineCode>cd {app.localPath}</InlineCode>.
              </Step>
              <Step n={2}>
                Installera Vercel CLI globalt (engångs): <InlineCode>npm i -g vercel</InlineCode>
              </Step>
              <Step n={3}>
                Logga in: <InlineCode>vercel login</InlineCode>
              </Step>
              <Step n={4}>
                Länka till ditt Vercel-projekt: <InlineCode>vercel link</InlineCode>
              </Step>
              <Step n={5}>
                Lägg till miljövariablerna ovan i Vercel-dashboarden under <b className="text-fg">Settings → Environment Variables</b>, eller via CLI: <InlineCode>vercel env add</InlineCode>
              </Step>
              <Step n={6}>
                Första deploy till produktion: <InlineCode>vercel --prod</InlineCode>
              </Step>
              <Step n={7}>
                Konfigurera din egen subdomän i Vercel under <b className="text-fg">Settings → Domains</b> (t.ex. <InlineCode>{subdomainExample}</InlineCode>) och lägg till motsvarande CNAME-post hos din DNS-leverantör.
              </Step>
            </ol>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setImportOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted hover:text-fg hover:bg-hover transition-colors"
            >
              <span>Eller: deploya via GitHub import (autodeploy vid push)</span>
              {importOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            {importOpen && (
              <div className="px-4 pb-4 pt-2 border-t border-border">
                <ol className="flex flex-col gap-2.5 mt-2">
                  <Step n={1}>
                    Forka eller klona repot <InlineCode>{app.repoSlug}</InlineCode> till ditt eget Git-konto.
                  </Step>
                  <Step n={2}>
                    I Vercel: <b className="text-fg">New Project → Import Git Repository</b> och välj din fork.
                  </Step>
                  <Step n={3}>
                    Lägg till miljövariablerna ovan under <b className="text-fg">Environment Variables</b> innan du deployar.
                  </Step>
                  <Step n={4}>
                    Klicka <b className="text-fg">Deploy</b>. Varje push till huvudbranchen triggar nu en ny deploy automatiskt.
                  </Step>
                  <Step n={5}>
                    Konfigurera din subdomän under <b className="text-fg">Settings → Domains</b>.
                  </Step>
                </ol>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setAiOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted hover:text-fg hover:bg-hover transition-colors"
            >
              <span className="flex items-center gap-2">
                <Sparkles size={12} className="text-amber-400" />
                Eller: låt en AI-assistent guida dig (eller deploya åt dig)
              </span>
              {aiOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            {aiOpen && (
              <div className="px-4 pb-4 pt-3 border-t border-border flex flex-col gap-3">
                <p className="text-xs text-muted leading-relaxed">
                  Kopiera prompten nedan och klistra in den i din AI-assistent — t.ex. <b className="text-fg">Claude</b>, <b className="text-fg">ChatGPT</b>, eller <b className="text-fg">Claude Code / Cursor</b> (med terminal-åtkomst kan AI:n köra deploy-kommandona åt dig). AI:n kommer börja med att ställa frågor om din domän, ditt Vercel-konto och dina Supabase-nycklar.
                </p>
                <CopyBlock text={buildAiPrompt(app)} />
                <p className="text-xs text-muted leading-relaxed">
                  <b className="text-fg">OBS:</b> dela aldrig dina Supabase-nycklar med en publik chatbot utan slutpunkts-kryptering. Använd helst en lokal AI-agent (Claude Code, Cursor) som kör i din egen miljö.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function SatellitApparPanel() {
  return (
    <div className="px-8 py-6 max-w-2xl flex flex-col gap-5">
      <div className="flex flex-col gap-2 px-5 py-4 rounded-xl border border-border bg-elevated">
        <p className="text-sm font-medium text-fg">Satellit-appar i open-crm-ekosystemet</p>
        <p className="text-xs text-muted leading-relaxed">
          Utöver desktop-appen består open-crm av fyra fristående webbappar som körs på egna subdomäner och delar samma Supabase-databas. Varje app deployas oberoende — du kan välja Vercel (rekommenderat) eller annan host. Alla värden för miljövariabler hittar du under <InlineCode>Avancerat → DataBase</InlineCode>. Använd din egen domän när du konfigurerar subdomänerna.
        </p>
      </div>

      {APPS.map((app) => (
        <AppCard key={app.id} app={app} />
      ))}
    </div>
  )
}
