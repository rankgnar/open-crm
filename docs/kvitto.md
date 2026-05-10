# Módulo: Kvitto

Gestión de **recibos físicos** que no llegan por mail (compras en caja, gasolina, ferretería, etc.). El admin sube el recibo desde el CRM desktop o desde la PWA `open-crm-remote` (cámara o file picker), completa los datos, y lo marca como `hanterade` cuando lo ha procesado. Sin envío automático a Fortnox por ahora — el cambio de estado es manual.

> El campo `fortnox_voucher_id` ya está reservado en la tabla para una futura integración (Voucher / SupplierInvoice).

## Base de datos

Tabla: `kvitton` · Bucket: `kvitton` · Migración: `supabase/migrations/20260429220000_create_kvitton.sql`

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| datum | date | fecha del recibo |
| leverantor | text | proveedor (libre, p. ej. "Bauhaus") |
| belopp | numeric(12,2) | total **inkl. moms** |
| moms | numeric(12,2) nullable | IVA |
| kategori | text nullable | `drivmedel` / `material` / `verktyg` / `kontorsmateriel` / `representation` / `ovrigt` |
| beskrivning | text nullable | nota corta |
| projekt_id | uuid nullable | FK `projekt(id)` ON DELETE SET NULL — opcional |
| status | text | check: `att_hantera` (default) / `hanterade` |
| fil_storage_path | text | ruta dentro del bucket `kvitton` (`<año>/<timestamp>_<nombre>`) |
| fil_namn | text | nombre original del fichero |
| mime_type | text | PDF / JPG / PNG / HEIC / WEBP |
| storlek | bigint | bytes |
| fortnox_voucher_id | text nullable | preparado para futura integración |
| skapad_av_user_id | uuid nullable | FK `auth.users(id)` ON DELETE SET NULL — quién subió el recibo |
| skapad_at / uppdaterad_at | timestamptz | auto + trigger `kvitton_set_uppdaterad_at` |

Índices: `datum DESC`, `status`, `projekt_id`, `skapad_av_user_id`.

### RLS y Storage

Tabla `kvitton` y bucket `kvitton` con policies **admin-only** (`is_app_admin()`):

- `kvitton_admin_all` (FOR ALL TO authenticated)
- `kvitton_select_admin` / `kvitton_insert_admin` / `kvitton_delete_admin` sobre `storage.objects`

El CRM desktop usa `service_role` y bypasea RLS. La PWA `open-crm-remote` está restringida al admin vía `app_admins`.

## IPC (CRM desktop)

Handler: `src/main/ipc/kvitto.ts` · Registrado en: `src/main/index.ts`

| Canal | Acción |
|---|---|
| `db:kvitto:list` | Lista recibos con `projekt_nummer`/`projekt_titel` resueltos, orden por `datum DESC` |
| `db:kvitto:get` | Obtiene un recibo con datos del proyecto |
| `db:kvitto:upload` | Lee un fichero local, lo sube al bucket, devuelve metadata (`fil_storage_path`, `fil_namn`, `mime_type`, `storlek`) |
| `db:kvitto:create` | Inserta el row con la metadata del upload + datos del formulario |
| `db:kvitto:update` | Actualiza campos editables de un recibo |
| `db:kvitto:set-status` | Cambia status `att_hantera` ↔ `hanterade` |
| `db:kvitto:delete` | Borra el row + el fichero del bucket |
| `db:kvitto:open` | Abre el fichero en el navegador externo (signed URL 60s) |
| `db:kvitto:signed-url` | Devuelve una signed URL (3600s por defecto) — usado por el preview de imagen en el detalle |

El `dialog:open-file` (handler genérico definido en `projekt.ts`) abre el file picker nativo y devuelve `{ filePath, fileName, mimeType, size }`.

## Tipos

Archivo: `src/renderer/src/sections/kvitto/types.ts`

- `Kvitto` — registro tal como vive en la tabla
- `KvittoListItem` — `Kvitto` + `projekt_nummer` y `projekt_titel` resueltos
- `KvittoStatus` — `'att_hantera' | 'hanterade'`
- `KvittoKategori` — unión literal de las 6 categorías
- `KVITTO_KATEGORIER` — array `[{ value, label }]` para los `<select>`
- `CreateKvittoInput` / `UpdateKvittoInput`

Las mismas categorías se duplican en `open-crm-remote/src/lib/types.ts` (la PWA es repo separado).

## Componentes (CRM desktop)

Todos en `src/renderer/src/sections/kvitto/`

| Archivo | Responsabilidad |
|---|---|
| `KvittoSection.tsx` | Orchestrator — vista `list` / `create` / `detail`, único que llama IPC |
| `KvittoTable.tsx` | Tabla con filtro por status (Alla / Att hantera / Hanterade) |
| `KvittoForm.tsx` | Formulario de creación: file picker → datos → submit |
| `KvittoDetail.tsx` | Vista flat con preview lateral del fichero, edición inline, toggle status, borrar |
| `KvittoStatusBadge.tsx` | Badge visual del status (`emerald` para hanterade, `amber` para att hantera) |

Entrada en sidebar: `nav-sections.ts` con icono `ReceiptText`, posición **inmediatamente debajo de Fakturering**. Tipo `Section` extendido en `App.tsx` y `Sidebar.tsx`.

## Páginas (open-crm-remote)

Repositorio separado: `rankgnar/open-crm-remote`

| Archivo | Responsabilidad |
|---|---|
| `src/pages/KvittoListPage.tsx` | Lista con thumbnails (signed URLs cacheadas), filtro por status, tap en círculo cambia status |
| `src/pages/KvittoCreatePage.tsx` | "Ta foto" (`capture="environment"`) + "Välj fil" → form de campos → upload directo a Storage + insert en `kvitton` |

Acceso desde `MoreMenu` con icono `ReceiptText`. Vistas registradas en `lib/navigation.tsx` como `kvitto.list` y `kvitto.create`.

A diferencia del CRM desktop, la PWA habla directamente con Supabase (anon_key + RLS admin). No pasa por IPC.

## Flujo

### Desde CRM desktop
1. Sidebar → **Kvitto** → ve la lista filtrable por status.
2. **Nytt kvitto** → file picker (PDF/JPG/PNG/HEIC/WEBP) → upload sube al bucket y devuelve la metadata → completar datos (datum, leverantör, belopp, moms, kategori, projekt opcional, beskrivning) → **Spara kvitto**.
3. Click en una fila → detalle con preview lateral del fichero. Botones:
   - **Markera som hanterad** / **Ångra hantering** → toggle de status
   - **Redigera** → edición inline de los campos (sin reemplazar el archivo)
   - **Ta bort** → borra row + fichero del bucket

### Desde open-crm-remote (móvil)
1. MoreMenu → **Kvitto** → lista de recibos del admin (con thumbnails).
2. **Nytt kvitto** → "Ta foto" (cámara trasera) o "Välj fil" → form mínimo → **Spara kvitto** (subida directa a Storage).
3. Tap en el círculo de un recibo cambia su status.

## Notas

- **1 fichero por recibo.** Si quieres sustituir el fichero hay que borrar el recibo y crear uno nuevo (la edición no permite cambiar el adjunto).
- **`projekt_id` es opcional.** Un recibo sin proyecto se trata como gasto general de la empresa.
- **Categorías hardcoded.** No son editables desde Inställningar de momento — vive como literal en `types.ts`.
- **Fortnox.** El campo `fortnox_voucher_id` está reservado pero no se popula desde ningún flow actual. Cuando se implemente el envío, se decidirá entre `Voucher` (asiento contable directo, simple) y `SupplierInvoice` (factura de proveedor con conciliación).
- **OCR.** No implementado. Todos los datos se introducen manualmente.
