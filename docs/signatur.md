# Signatur — Firma digital de cliente vía link público

Permite que clientes firmen offerts y ordrar desde su móvil/desktop a través de un enlace único enviado por correo. La firma es canvas + auditoría completa (IP, User-Agent, timestamp). El admin sigue trabajando dentro del Electron CRM.

Tras firmar, el flujo automáticamente:
- Genera un **PDF firmado** y lo guarda en Supabase Storage
- Envía **emails configurables** (al cliente y al admin) con el link al PDF
- Actualiza el status del doc (`forslag.status='accepterat'` o `ordrar.status='Godkänd'`)
- Bumpa el status del **proyecto padre** a `Acepterat` (defensivo, solo si existe en el catálogo)
- Registra una **nota en `projekt_anteckningar`** con el firmante + IP + timestamp
- Todo controlable por toggle desde **Aktivitetslogg**

## Componentes

| Pieza | Ruta |
|---|---|
| App pública (cliente) | `/home/rankgnar/projects/dev/crm-sign` (Vite SPA + jsPDF) |
| Botón + panel en CRM | `src/renderer/src/sections/signatur/` (Modal + LankarPanel) |
| Timeline en panel lateral | `src/renderer/src/sections/forslag/ForslagKostnadsPanel.tsx` |
| Integración por documento | `src/renderer/src/sections/forslag/ForslagDetail.tsx`, `.../order/OrderDetail.tsx` |
| Handlers IPC | `src/main/ipc/signatur.ts` |
| URL builder | `src/main/lib/signaturUrl.ts` |
| RPCs Supabase | `get_signing_doc`, `submit_signature`, `revoke_signing_link`, `inject_template_vars` |

## Tablas

### `signatur_lankar`

| Campo | Notas |
|---|---|
| `id`, `token` | Token = 32 chars URL-safe base64 (24 bytes random) |
| `dokument_typ` | `'forslag' \| 'order' \| 'fritt'` (`'fritt'` = documentos libres del módulo [Signera](signera.md), `dokument_id` referencia `signatur_fritta_dokument`) |
| `dokument_id` | FK lógica al doc |
| `kund_id`, `kund_email` | Snapshot del destinatario al crear el link |
| `dokument_hash` | SHA-256 del título + nummer + projekt + kund (auditoría: ¿cambió tras firmar?) |
| `meddelande`, `skapad_av` | Mensaje opcional + admin que lo creó |
| `gar_ut_at` | Expiración (default 30 días, configurable 7/14/30/60/sin límite) |
| `oppnad_at` | Primera vez que el cliente abrió el link (server side) |
| `signerad_at`, `signerad_namn`, `signerad_ip`, `signerad_ua`, `signatur_data` | Auditoría completa |
| `signed_pdf_url` | URL público del PDF firmado en Storage |
| `revoked_at` | Admin revocó manualmente |

RLS habilitado **sin policies** para anon/authenticated → solo `service_role` (CRM) y los RPCs `SECURITY DEFINER` acceden.

### Campos de firma en `forslag` y `ordrar`

Ambas tablas comparten `godkand_av`, `godkand_datum`, `signatur_data`. La RPC `submit_signature` los rellena al firmar y cambia el status (`accepterat` / `Godkänd`).

### `epost_mallar.system_kod`

Columna nueva (TEXT, índice único) que permite al RPC referenciar mallar por código estable, independiente del `namn`. Códigos del sistema usados por el flujo de firma:

| `system_kod` | `namn` (default) | Cuándo se envía |
|---|---|---|
| `signatur_begaran` | Signaturbegäran | Cliente recibe link de firma |
| `signatur_bekraftelse_kund` | Signatur — bekräftelse till kund | Cliente, tras firmar |
| `signatur_bekraftelse_admin` | Signatur — notis till admin | Admin, tras firma del cliente |

Si una de las mallar se borra, el RPC cae al texto inline hardcoded — nunca rompe el flujo.

### Storage bucket `signed-docs`

Público para `SELECT` (los clientes descargan vía URL del email). `INSERT/UPDATE` permitidos solo a anon si existe `signatur_lankar` válido para el token usado como folder. Path convencional: `<token>/signed.pdf`.

## RPCs

### `get_signing_doc(p_token)`

`SECURITY DEFINER`. Devuelve `jsonb` con:

```jsonc
{
  "status": "ok" | "expired" | "revoked" | "signed" | "not_found",
  "doc_typ": "forslag" | "order",
  "doc": { /* fila completa de forslag/ordrar */ },
  "lines": [ /* faser→subfaser→arbete/material/UE para forslag, rader para order */ ],
  "kund": { ... },
  "projekt": { ... },
  "foretag": { ... },  // de app_installningar
  "gar_ut_at": "...",
  "signerad_at": "..." | null
}
```

Marca `oppnad_at = now()` si es la primera apertura. Granted a `anon` y `authenticated`.

### `submit_signature(p_token, p_namn, p_signatur, p_ua, p_pdf_url)`

`SECURITY DEFINER`. Atómico:

1. `FOR UPDATE` en `signatur_lankar` — anti-race.
2. Valida vigencia/firmado/revocado.
3. Captura IP de `request.headers.x-forwarded-for`.
4. Actualiza `signatur_lankar` (signerad_at + audit fields + signatur_data + signed_pdf_url).
5. Actualiza el doc subyacente:
   - `forslag.status='accepterat'` + `godkand_av` + `godkand_datum` + `signatur_data`
   - O `ordrar.status='Godkänd'` con los mismos campos
6. Si el doc es `forslag` y `projekt_statusar` contiene `'Acepterat'` → bumpa `projekt.status='Acepterat'`.
7. Si `aktivitetslogg_installningar.signatur_inskickad.aktiv = true`:
   - Inserta nota en `projekt_anteckningar`.
   - Lee mall `signatur_bekraftelse_kund` + variables → encola email al cliente.
   - Lee mall `signatur_bekraftelse_admin` + variables → encola email al admin.
8. Devuelve `{ status: 'signed' }`.

Granted a `anon` y `authenticated`.

### `revoke_signing_link(p_id)`

Admin-only via service_role (sin GRANT a anon).

### `inject_template_vars(template, vars jsonb)`

Helper genérico que reemplaza `{{key}}` con `vars->>key`. Usado por `submit_signature` para renderizar las mallar de bekräftelse.

## IPC handlers

| Canal | Argumentos | Retorna |
|---|---|---|
| `db:signatur-lank:create` | `{ dokument_typ, dokument_id, kund_email, giltig_dagar, meddelande?, mall_id? }` | fila completa |
| `db:signatur-lank:list-for-doc` | `(typ, id)` | array (DESC por skapad_at) |
| `db:signatur-lank:revoke` | `(id)` | void — soft (marca `revoked_at`) |
| `db:signatur-lank:delete` | `(id)` | void — hard (elimina la fila completa) |
| `db:signatur-lank:resend` | `(id, mall_id?)` | void — re-encola email con el mismo token |
| `db:signatur-lank:get-default-mall` | `()` | id de la primera mall en kategori `'Signatur'` |
| `db:signatur-lank:render-document-pdf` | `{ link_id, html, landscape? }` | `{ url }` — Electron printToPDF + upload a `signing-pdfs/<token>/document.pdf`, escribe `document_pdf_url` |
| `db:forslag:get` | `(id)` | fila de forslag con projekt+kund (refresh post-firma) |
| `db:order:get` | `(id)` | fila de order con rader (refresh post-firma) |

`db:signatur-lank:create` también:
- Bumpa `forslag.status` de `utkast` → `skickat` (o `ordrar.status` `Utkast` → `Skickad`) defensivamente.
- Encola email vía la mall `signatur_begaran` con variables sustituidas.

## App pública (open-crm-sign)

```
URL: <web_app_url>/?t=TOKEN
```

Stack idéntico a `open-crm-app` (React + Vite + Tailwind v4, accent emerald) + `jspdf` para generación de PDF. Default theme **light**. Páginas:

1. **Loading** — llama `get_signing_doc`.
2. **DocumentRender** — header con logo + företagsdata, título + número, kund/projekt, especificación (faser→subfaser→arbete/material/UE para forslag, rader para order), totales (computados client-side para forslag, leídos para order).
3. **SignaturePad** — canvas HTML5 con soporte mouse/touch + stylus. Stroke siempre `#18181b` sobre fondo blanco (visible en cualquier tema).
4. **Confirm form** — input nombre + checkbox "Jag intygar att jag är behörig" + botón "Signera digitalt".
5. **Sign action** atómico:
   1. Genera PDF A4 con `jsPDF` (`src/lib/pdf.ts`): logo + título + kund/projekt + jerarquía completa + totales + firma como imagen + nombre + fecha.
   2. Sube a Storage en `signed-docs/<token>/signed.pdf` (upsert).
   3. Lee URL público.
   4. Llama `submit_signature` con la URL.
6. **Success** — botón verde "Ladda ner signerat PDF".
7. **Error states** — `expired`, `revoked`, `signed` (ya firmado, mostrar firmante + fecha), `not_found`.

Configuración: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` en `.env`.

## Panel "Signering" — paridad ForslagDetail / OrderDetail

Componente compartido `<SignaturTimeline />` en `src/renderer/src/sections/signatur/SignaturTimeline.tsx` con props:
- `docStatus` — status actual del doc
- `acceptedStatuses` — `['accepterat']` para forslag / `['Godkänd']` para order
- `rejectedStatuses` — `['avvisat']` / `['Avvisad']`
- `latestLink` — fila más reciente de `signatur_lankar`

Renderiza un **timeline tipo roadmap**:

```
🟡 Skickat              2026-04-26 15:32
🔵 Mottagit             2026-04-26 15:48
🟢 Signerat             2026-04-26 16:02
   Raul Cervera

[ Ladda ner signerat PDF ]
```

Estados posibles del último evento:
- ✅ **Signerat** + nombre del firmante (verde)
- ❌ **Återkallad** (rojo) — admin invalidó
- 👁 **Väntar på signatur...** (ámbar) — abrió pero no firmó
- (solo Skickat si ni siquiera abrió aún)

**Ubicación**:
- `ForslagDetail`: dentro de `ForslagKostnadsPanel` (sidebar derecha, sustituye AI-analys)
- `OrderDetail`: en sidebar derecha dedicada `w-96` (paridad con Forslag), encima del `<SignaturLankarPanel />`

**Live updates**: ambos `*Detail` componentes hacen polling cada 8s + listener de `window 'focus'` mientras hay link sin firmar. Tras cada tick:
1. Re-fetcha el último link → `latestLink` actualizado → timeline avanza
2. Re-fetcha el doc subyacente vía `db:forslag:get` / `db:order:get` → `forslag.status` / `order.status` mirror local actualizado → status pill, badge color, godkand fields se refrescan sin recargar

**Tinting de filas en lista**:
- `ProjektTable`: filas con status `farg='emerald'` (incluido auto-`Acepterat`)
- `ForslagTable`: filas con `status='accepterat'`
- `OrderTable`: filas con `status='Godkänd'`

Tint usado: `bg-emerald-400/[0.06]` (6% opacidad, no domina visualmente).

## Despliegue

### Fase 1 — Vercel
1. Push del repo `open-crm-sign` a GitHub: `https://github.com/rankgnar/open-crm-sign`
2. Conectar a Vercel (autodetecta Vite).
3. Variables en Vercel project settings: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Anotar la URL asignada y configurarla en el CRM admin → SetupWizard → `web_app_url`.

### Fase futura — VPS propio
`npm run build` → `dist/` → `rsync` al VPS → nginx con `try_files $uri /index.html` → cert via certbot. Si Supabase también migra al VPS, actualizar `VITE_SUPABASE_URL` y configurar CORS en Kong.

## Aktivitetslogg

Toggle en Inställningar → Aktivitetslogg:

- `signatur_inskickad` → "Auto-logg vid kundsignatur (anteckning + e-post)" — controla si la firma genera nota en `projekt_anteckningar` + emails.

Si está OFF, la firma se registra (status del doc cambia, audit en `signatur_lankar`) pero sin side-effects.

## Plantillas de email — variables disponibles

Las 3 mallar (`signatur_begaran`, `signatur_bekraftelse_kund`, `signatur_bekraftelse_admin`) son **editables desde Inställningar → E-post mallar**. Soportan:

| Variable | Disponible en | Para qué |
|---|---|---|
| `{{kund_namn}}` | todas | Nombre del cliente |
| `{{kund_email}}` | todas | Email del cliente |
| `{{foretag_namn}}` | todas | Tu empresa |
| `{{namn}}` | bekräftelse | Quien firmó (puede diferir del kund) |
| `{{doc_nummer}}` | todas | F-0003 / O-0001 |
| `{{forslag_nummer}}` / `{{order_nummer}}` | begäran | Específico para template inicial |
| `{{doc_typ}}` | bekräftelse | `'forslag'` / `'order'` (raw) |
| `{{doc_typ_label}}` | bekräftelse | `'offert'` / `'order'` (display) |
| `{{doc_typ_label_def}}` | bekräftelse | `'offerten'` / `'ordern'` (artículo) |
| `{{titel}}` | bekräftelse_admin | Título del documento |
| `{{datum}}` | bekräftelse | Fecha+hora de la firma (Stockholm) |
| `{{ip}}` | bekräftelse_admin | IP del firmante |
| `{{signatur_lank}}` | begäran | URL público para firmar |
| `{{signatur_giltigt_till}}` | begäran | Fecha de expiración |
| `{{pdf_lank}}` | bekräftelse | URL crudo del PDF firmado |
| `{{pdf_button}}` | bekräftelse_kund | Botón verde HTML pre-construido (vacío si no hay PDF) |
| `{{pdf_admin_line}}` | bekräftelse_admin | Línea con el link para admin |
| `{{meddelande}}` | begäran | Mensaje opcional del admin |
| `{{alias_signatur}}` | todas | Firma HTML del alias FROM |

Cada mall puede tener su propio **alias_id** → distinto FROM email para cada tipo (ej. `noreply@` para begäran, `info@` para confirmaciones).

## Seguridad

- **Token**: 24 bytes random (≥192 bits efectivos), URL-safe base64.
- **Acceso a `signatur_lankar`**: anon/authenticated → bloqueado por RLS sin policies. Solo via RPC `SECURITY DEFINER`.
- **Anti-replay**: `submit_signature` hace `FOR UPDATE` y rechaza si `signerad_at IS NOT NULL`.
- **IP server-side**: capturada de `x-forwarded-for` (Supabase). UA captado client-side (best-effort).
- **HTTPS obligatorio** — Vercel lo aporta automáticamente.
- **`dokument_hash`** congelado al crear el link → audit forense.
- **Storage `signed-docs`**: bucket público para SELECT (link compartible), INSERT/UPDATE solo anon con token vigente.
- **Zoho OAuth** (depende de `epost.ts`): usa `prompt=consent` + preserva `refresh_token` al re-auth — sesión estable.

## Verificación end-to-end

1. CRM admin → Forslag o Order detail → "Skicka för signatur" → llenar email + duración → enviar.
2. Verificar fila en `signatur_lankar` y entrada en `epost_ko` (estado `'väntar'`).
3. El ticker (`epost.ts setInterval 60s`) procesa la cola y envía vía Zoho.
4. Cliente recibe email con link → abre en móvil/desktop → ve el doc renderizado en modo light.
5. Firma + nombre + checkbox → submit. Cliente ve botón "Ladda ner signerat PDF".
6. Verificar en BD:
   - `signatur_lankar.signerad_at/ip/ua/signatur_data/signed_pdf_url` rellenos.
   - `forslag.status='accepterat'` o `ordrar.status='Godkänd'`.
   - `projekt.status='Acepterat'` (si aplica).
   - Nota en `projekt_anteckningar`.
   - 2 emails encolados (cliente + admin) con `alias_id` correcto.
7. CRM admin → mismo doc:
   - Panel "Länkar" muestra `signerad`, IP, fecha, namn.
   - Panel "Signering" muestra timeline completo con botón "Ladda ner signerat PDF".
8. Lista de Projekt → fila del proyecto se ve en verde tenue.

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| "Länken hittades inte" tras enviar email | Link revocado/expirado/borrado | Ver fila en `signatur_lankar`. Crear uno nuevo. |
| Email no llega ni a spam | Sesión Zoho expirada | Inställningar → E-post → reconectar Zoho. Ver `epost_ko.fel_meddelande`. |
| `has_refresh: false` en app_installningar | Reauth Zoho sin `prompt=consent` | Ya corregido — reconectar fuerza nuevo refresh_token. |
| PDF no se genera | Logo demasiado grande / formato no soportado | Ver consola del navegador. Logo debe ser data URL PNG/JPG. |
| Firma invisible en pad | Stroke heredado del theme | Ya corregido — siempre `#18181b` sobre fondo blanco. |
| Forslag.status sigue en `'utkast'` tras enviar link | Migración 20260427001x no aplicada | Verificar con `\d forslag`. |

## Migraciones aplicadas

| Migración | Qué hace |
|---|---|
| `20260427001000` | Añade `godkand_av`, `godkand_datum`, `signatur_data` a `forslag` |
| `20260427001100` | Crea `signatur_lankar` |
| `20260427001200` | RPCs `get_signing_doc`, `submit_signature`, `revoke_signing_link` |
| `20260427001300` | RLS en `signatur_lankar` |
| `20260427001400` | Aktivitetslogg toggle `signatur_inskickad` |
| `20260427001500` | Seed mall `Signaturbegäran` |
| `20260427001600` | Fix RPC para jerarquía 3-niveles (subfaser) |
| `20260427001700` | `submit_signature` bumpa `projekt.status='Acepterat'` |
| `20260427001800` | Storage bucket `signed-docs` + RLS |
| `20260427001900` | `signatur_lankar.signed_pdf_url` |
| `20260427002000` | `submit_signature` acepta `p_pdf_url` |
| `20260427002100` | `epost_mallar.system_kod` + 2 nuevas mallar (kund + admin) |
| `20260427002200` | Helper `inject_template_vars` |
| `20260427002300` | `submit_signature` lee mallar via `system_kod` |
| `20260427002400` | Fix RLS recursion: helper `signatur_lank_uploadable` para storage policies |
| `20260427002500` | Fix bekräftelse-mail destination: usa `signatur_lankar.kund_email` |
| `20260427002600` | Storage bucket `signing-pdfs` + columna `document_pdf_url` |
| `20260427002700` | `get_signing_doc` expone `document_pdf_url` y `signed_pdf_url` |

## Cambios arquitecturales — Fase final

**Cliente firma el PDF oficial** (no HTML reconstruido):
- Al enviar el link, el CRM admin renderiza la plantilla configurada en PDF-konfiguration → FÖRSLAG/ORDER (`DEFAULT_FORSLAG_HTML` / `DEFAULT_ORDER_HTML` con `injectVars`) usando Electron `printToPDF`. Subido a `signing-pdfs/<token>/document.pdf`.
- El cliente lo abre y ve **ese PDF idéntico** rendereado con `pdfjs-dist` como canvases inline (no iframe — evita el problema móvil donde el botón back saca al cliente del flujo).
- Después de firmar, `pdf-lib` añade un bloque compacto de firma al final de la última página existente del PDF (no página nueva), y un footer `Sida X av Y · DOC-XXXXXXXX` en TODAS las páginas. El resultado se sube a `signed-docs/<token>/signed.pdf`.

**Status auto-sync server-side**:
- `db:signatur-lank:create` → `forslag.status` `utkast → skickat` o `ordrar.status` `Utkast → Skickad`.
- `submit_signature` → `accepterat` / `Godkänd` + `projekt.status='Acepterat'` (solo forslag).
- UI live mirror en `ForslagDetail` y `OrderDetail` re-fetcha el doc cada 8s mientras hay link sin firmar.

**Configurable por admin**:
- 3 mallar de email en Inställningar → E-post mallar (kategori `Signatur`), con alias FROM independiente cada una.
- Toggle global en Aktivitetslogg para desactivar auto-emails + auto-anteckning.

## Roadmap Fase 2

- BankID via Scrive/Signicat/Criipto (validez eIDAS).
- Múltiples firmantes secuenciales.
- Webhook (Slack/Teams) cuando se firma.
- Comparación visual del documento congelado vs estado actual usando `dokument_hash`.
- Migración del crm-sign al VPS auto-hospedado.
- Adjuntar PDF directamente al email vía Zoho attachment API (en lugar de link).
- Posicionamiento configurable de la firma sobre el PDF (en vez de bloque fijo bottom de última página).
