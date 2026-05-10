# Arquitectura Base

## Stack

Electron 33 · React 18 · TypeScript 5.5 · Tailwind CSS v4 · Supabase (PostgreSQL)

## Flujo de datos

```
Renderer → window.api.invoke(canal) → Preload (contextBridge) → Main (ipcMain) → Supabase
```

El renderer **nunca** importa ni toca Supabase directamente.

## Archivos clave

| Archivo | Rol |
|---|---|
| `src/main/index.ts` | BrowserWindow + registro de handlers IPC |
| `src/main/supabase.ts` | Cliente Supabase singleton (usa `SUPABASE_URL` + `SUPABASE_ANON_KEY`) |
| `src/preload/index.ts` | Expone `window.api.invoke()` vía contextBridge |
| `src/renderer/src/App.tsx` | Layout shell + navegación por estado (`activeSection`) |
| `src/renderer/src/components/Sidebar.tsx` | Nav colapsable — no modificar |
| `src/renderer/src/components/TitleBar.tsx` | Barra de título custom — no modificar |
| `src/renderer/src/style.css` | Tokens de tema (`@theme`) — no modificar |
| `src/renderer/src/types/electron.d.ts` | Declaración TypeScript de `window.api` |

## Convenciones IPC

- Canal: `db:<entidad>:<acción>` → ej. `db:kunder:list`
- Handler devuelve dato directo o lanza `Error` (sin wrappers)
- Renderer castea resultado: `as Kund[]`

## Tema visual

Variables CSS: `bg-bg`, `bg-sidebar`, `bg-elevated`, `border-border`, `bg-hover`, `text-fg`, `text-muted`, `text-subtle`
Estados: `text-emerald-400` (éxito) · `text-red-400` (error) · `text-amber-400` (advertencia)

## Variables de entorno

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` (solo para migraciones CLI)

## Comandos

| Comando | Uso |
|---|---|
| `npm run dev` | Dev con hot-reload |
| `npm run typecheck` | Verificar TypeScript |
| `npx supabase db query --linked "<SQL>"` | Ejecutar migración en remoto |
