# Signera — Firma de documentos libres

Sección dedicada a enviar **cualquier documento** (PDF o imagen) a un cliente para que lo firme digitalmente. Reutiliza la infra de [`signatur`](signatur.md) (portal `open-crm-sign`, RPC `submit_signature`, mallar de email) pero sin estar atada a un `forslag` u `ordrar` existente — el documento es libre. Tras firmar, el PDF firmado se **archiva en el `DokumentPanel` del proyecto** asociado.

## Flujo

```
Sidebar "Signera" → Nytt dokument
    ↓
[Modal] välj projekt + titel + fil + kund-email + giltighet + mall
    ↓
db:signera:create
    1. Lee el archivo (main process)
    2. Si no es PDF → printToPDF (HTML+<img>) → PDF
    3. Sube a signing-pdfs/<token>/document.pdf
    4. Inserta signatur_fritta_dokument
    5. Inserta signatur_lankar (dokument_typ='fritt')
    6. Encola email vía mall categoría 'Signatur'
    ↓
Cliente abre link → portal open-crm-sign → firma (estampa firma sobre el PDF) → submit_signature
    ↓
Admin abre el detalle en CRM → "Spara till projekt"
    ↓
db:signera:archive-to-projekt
    1. Descarga signed_pdf_url
    2. Sube a projekt-dokument/<projekt_id>/<timestamp>_signerat_<safe>.pdf
    3. Inserta projekt_dokument (filnamn = "[Signerat] <titel>.pdf")
    4. Marca signatur_fritta_dokument.arkiverad_dokument_id + arkiverad_at
```

## Componentes

| Pieza | Ruta |
|---|---|
| Sección UI | `src/renderer/src/sections/signera/` |
| Tabla de listado | `SigneraTable.tsx` |
| Modal de creación | `SigneraSkapaModal.tsx` |
| Vista de detalle (split + sidebar Signering) | `SigneraDetail.tsx` |
| Handlers IPC | `src/main/ipc/signera.ts` |
| Migraciones | `supabase/migrations/20260427034802_signera_fritta_dokument.sql`, `20260427034803_get_signing_doc_fritt.sql` |

## Tabla `signatur_fritta_dokument`

Almacena la metadata del archivo subido. El `id` se usa como `signatur_lankar.dokument_id` cuando `dokument_typ='fritt'`.

| Campo | Notas |
|---|---|
| `id` | UUID PK |
| `projekt_id` | FK a `projekt(id)` `ON DELETE CASCADE` — proyecto obligatorio |
| `titel` | Título visible en la lista, modal y emails (variable `{{dokument_titel}}`) |
| `filnamn`, `mime_type`, `storlek` | Metadatos del fichero original |
| `storage_path` | Path en bucket `signing-pdfs` (siempre `<token>/document.pdf`) |
| `arkiverad_dokument_id` | FK a `projekt_dokument(id)` `ON DELETE SET NULL` — null hasta que se archiva |
| `arkiverad_at` | Timestamp de archivado (idempotencia: si ya está, archive es no-op) |
| `skapad_at` | Default `now()` |

Índice: `idx_signatur_fritta_dokument_projekt(projekt_id)`.

## Cambios en `signatur_lankar`

CHECK extendido para aceptar el tercer valor:

```sql
CHECK (dokument_typ IN ('forslag', 'order', 'fritt'))
```

Cuando `dokument_typ='fritt'`, `dokument_id` referencia `signatur_fritta_dokument.id`.

## Cambios en RPCs

### `submit_signature(p_token, p_namn, p_signatur, p_ua, p_pdf_url)`

Tercera rama (`ELSIF v_link.dokument_typ = 'fritt'`):
- No actualiza `forslag` ni `ordrar` (no hay doc subyacente).
- Resuelve `v_projekt_id` + `v_doc_titel` desde `signatur_fritta_dokument`.
- El resto (anteckning, emails kund/admin) sigue idéntico — usa `dokument_titel` en lugar de `forslag_nummer/order_nummer`.

`v_doc_typ_label` es `'dokument'` y `v_doc_typ_label_def` `'dokumentet'`.

> **Nota**: existe una versión legacy `submit_signature(text, text, text, text)` de 4 argumentos sin la rama `'fritt'`. El portal moderno (con PDF) llama siempre la de 5 args, pero si en el futuro se vuelve a una llamada de 4 args, hay que extender o droppear esa función.

### `get_signing_doc(p_token)`

Tercera rama lee `signatur_fritta_dokument` como `v_doc`, devuelve `v_lines = []`, y resuelve `v_projekt`/`v_kund` vía el `projekt_id` del registro.

## IPC handlers

| Canal | Argumentos | Retorna |
|---|---|---|
| `db:signera:list` | `()` | array de `{ lank, dokument, projekt, kund }` (DESC por `skapad_at`) |
| `db:signera:get` | `(lank_id)` | `{ lank, dokument }` |
| `db:signera:create` | `{ projekt_id, titel, filnamn, mime_type, filePath, storlek, kund_email, giltig_dagar, meddelande?, mall_id? }` | `{ lank, dokument }` |
| `db:signera:archive-to-projekt` | `(lank_id)` | `{ already_archived, projekt_dokument_id }` |

`db:signera:create` extiende a `signatur.ts:registerSignaturHandlers` reutilizando:
- `tokenStr()` para el token URL-safe (32 chars)
- `pickEmailMall()` con fallback a la primera mall categoría `'Signatur'`
- Variables del template: `kund_namn`, `projekt_namn`, `dokument_titel`, `signatur_lank`, `signatur_giltigt_till`, `meddelande`, `alias_signatur` (`forslag_nummer` y `order_nummer` quedan vacíos para 'fritt')

## Conversión a PDF

El portal estampa la firma sobre el PDF, así que el archivo subido **debe ser PDF al llegar a `signing-pdfs/<token>/document.pdf`**. Política en `signera.ts:convertToPdf`:

| Input | Acción |
|---|---|
| `application/pdf` | Pasa directo |
| `image/*` (jpg/png/etc) | `BrowserWindow.printToPDF` envolviendo `<img>` en HTML A4 (95vw × 95vh `object-fit: contain`) |
| Cualquier otro (Word, Excel…) | Throw `Filtypen "X" stöds ej. Konvertera till PDF först.` |

El UI valida en cliente antes de mandar (rechaza no-PDF/no-imagen en `SigneraSkapaModal`).

## Vista de detalle

Layout split (paridad con `OrderDetail`):

- **Izquierda** — contenido principal: header de título, *Mottagare & projekt* (grid 3 cols), *Dokument* (icono + filnamn + storlek + botones "Original" / "Signerad PDF").
- **Derecha** (sidebar `w-96 border-l`): cabecera **Signering** + `<SignaturTimeline />` (Skickat → Mottagit → Signerat) + `<SignaturGodkannandeBlock />` (cuando firmado, mapeando los campos del lank: `signerad_namn`, `signerad_at`, `signatur_data`) + `<SignaturLankarPanel dokument_typ="fritt" dokument_id={...} />` para gestión de links (copia/resend/revoke/delete).

Botón **Spara till projekt** en el header (solo cuando `signed && !archived`); tras el archivado se sustituye por el badge ✅ *Arkiverat i projekt*.

## Restricciones / decisiones

- **Projekt obligatorio**: el destino final es el `DokumentPanel` del proyecto, no permite envíos huérfanos.
- **Reutiliza mall categoría `Signatur`**: no hay categoría dedicada `SignaturFritt`. Si una mall usa `{{forslag_nummer}}` o `{{order_nummer}}`, en 'fritt' renderizan vacío — añadir `{{dokument_titel}}` a la mall si se quiere identificar el documento en el subject/body.
- **Archivado idempotente**: si `arkiverad_dokument_id` ya existe, `archive-to-projekt` no duplica — devuelve `{ already_archived: true }`.
- **Borrar el lank no desarchiva**: el archivado vive en `projekt_dokument` independientemente. Borrar `signatur_lankar` mantiene el archivo en el projekt.
