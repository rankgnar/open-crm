# open-crm

> Electron desktop CRM for construction and service companies — self-hosted, MIT licensed.

A full-featured offline-capable CRM built with Electron, React and Supabase. Designed for companies that want full control over their data without monthly SaaS fees.

**Website:** [open-crm.org](https://open-crm.org)  
**License:** [MIT](LICENSE)

---

## Modules

| Module | Purpose |
|---|---|
| **Kunder** | Customers — companies, contacts and history |
| **Projekt** | Projects linked to customers with status and budget |
| **Schema** | Planning — tasks, visits, deliveries and meetings |
| **Förslag** | Quotes — phases, labor, materials, ROT deduction and PDF export |
| **ÄTA** | Change orders — additions and deductions on live projects |
| **Ekonomi** | Cost vs budget, margin and invoicing status |
| **Fakturor** | Invoice lifecycle — draft, sent, paid |
| **Personal** | Staff, time reports and absence management |
| **E-post** | Inbox linked to customers and projects |
| **Chat** | Internal team communication |
| **Kalender** | Shared team calendar |
| **Workflows** | Visual node editor for AI-assisted automation |

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop | Electron 33 |
| Build | electron-vite 2, Vite 5 |
| UI | React 18, TypeScript 5.5 |
| Styling | Tailwind CSS v4 |
| Icons | lucide-react |
| Database | Supabase (PostgreSQL) |
| Security | contextBridge + contextIsolation |

The renderer process never touches Supabase directly — all data flows through IPC to the main process.

---

## Companion apps

| App | Repo | Purpose |
|---|---|---|
| Admin PWA | [open-crm-remote](https://github.com/rankgnar/open-crm-remote) | Mobile admin access from the field |
| Employee PWA | [open-crm-app](https://github.com/rankgnar/open-crm-app) | Time tracking and HR for field workers |
| Customer portal | [open-crm-client](https://github.com/rankgnar/open-crm-client) | Project overview and document signing |
| Signing portal | [open-crm-sign](https://github.com/rankgnar/open-crm-sign) | Digital signature flow |
| Questionnaire forms | [open-crm-form](https://github.com/rankgnar/open-crm-form) | AI-generated client questionnaires |
| VPS setup | [open-crm-setup](https://github.com/rankgnar/open-crm-setup) | One-command self-hosted install |

---

## Getting started

```bash
git clone https://github.com/rankgnar/open-crm.git
cd open-crm
npm install
```

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_ANON_KEY=<anon key>
```

```bash
npm run dev       # Start with hot-reload
npm run build     # Production build
npm run typecheck # Type check
```

---

## Self-hosted database

Use [open-crm-setup](https://github.com/rankgnar/open-crm-setup) to spin up a self-hosted Supabase instance with all tables pre-configured, or point the app at any Supabase cloud project.

---

## License

[MIT](LICENSE) — fork it, run it, ship it.
