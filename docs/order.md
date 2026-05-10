# Módulo: Order (ändringsorder / ÄTA)

Órdenes de trabajo extra fuera del presupuesto inicial del proyecto. El cliente debe **aprobar y firmar digitalmente** la order antes de que se ejecute el trabajo.

ÄTA = **Ä**ndrings-, **T**illäggs- och **A**vgående arbete.

## Base de datos

Migración: `supabase/migrations/20260426180100_create_ordrar.sql`

### Tabla `ordrar`

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| order_nummer | text | UNIQUE, formato `O-NNNN` (auto via `order_nummer_seq`) |
| projekt_id | uuid | FK `projekt(id)` ON DELETE CASCADE |
| kund_id | uuid | FK `kunder(id)` |
| kund_namn | text | snapshot del nombre del cliente |
| kund_org_nr | text | snapshot del org-nummer |
| titel | text | requerido |
| beskrivning | text | justificación del trabajo extra |
| status | text | `Utkast` · `Skickad` · `Godkänd` · `Avvisad` (CHECK) |
| belopp_netto | numeric(12,2) | calculado desde rader |
| belopp_moms | numeric(12,2) | 25% sobre netto |
| belopp_total | numeric(12,2) | netto + moms |
| godkand_av | text | nombre del cliente que firma |
| godkand_datum | timestamptz | momento de la firma |
| signatur_data | text | base64 PNG del canvas |
| fas_id | uuid | FK `forslag_faser(id)` ON DELETE SET NULL — fase del projekt a la que se vincula la order |
| subfas_id | uuid | FK `forslag_subfaser(id)` ON DELETE SET NULL — subfase opcional |
| skapad_at | timestamptz | auto |
| uppdaterad_at | timestamptz | trigger global `update_updated_at` |

Índices: `idx_ordrar_projekt_id`, `idx_ordrar_status`, `idx_ordrar_kund_id`, `idx_ordrar_fas_id`, `idx_ordrar_subfas_id`.

### Tabla `order_rader`

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| order_id | uuid | FK `ordrar(id)` ON DELETE CASCADE |
| beskrivning | text | requerido |
| antal | numeric(12,2) | default 1 |
| enhet | text | default `'st'` |
| a_pris | numeric(12,2) | precio unitario excl. IVA |
| belopp | numeric(12,2) | `antal * a_pris` (recalculado por backend en cada cambio) |
| sortering | int | orden visual |
| skapad_at | timestamptz | auto |

Índice: `idx_order_rader_order_id`.

### Funciones / secuencia

- `order_nummer_seq` — secuencia
- `nextval_order_nummer()` — consume el siguiente número
- `peek_order_nummer()` — siguiente sin consumir

## IPC

Handler: `src/main/ipc/order.ts` · Registrado en: `src/main/index.ts`

| Canal | Acción |
|---|---|
| `db:order:list` | Lista todas con join a `projekt`, `fas` y `subfas` |
| `db:order:list-by-projekt` | Lista por projekt_id |
| `db:order:get` | Devuelve `OrderWithRader` (order + rader) |
| `db:order:create` | Crea (auto-snapshot kund desde projekt + nº O-NNNN) — acepta `rader[]` opcionales |
| `db:order:update` | Actualiza titel/beskrivning |
| `db:order:delete` | Borra (CASCADE rader) |
| `db:order:sign` | Marca `Godkänd` + guarda `godkand_av`, `godkand_datum`, `signatur_data` |
| `db:order:set-status` | Cambia status a `Utkast` / `Skickad` / `Avvisad`. Rechaza `Godkänd` (debe usar `:sign`). Si la order actual es `Godkänd`, limpia `signatur_data`/`godkand_av`/`godkand_datum`. |
| `db:order-rader:create` | Crea rad + recalcula totales |
| `db:order-rader:update` | Actualiza rad + recalcula belopp + totales |
| `db:order-rader:delete` | Borra rad + recalcula totales |
| `db:order-rader:reorder` | Actualiza `sortering` por array de IDs |
| `db:order-nummer:peek` | Próximo nº sin consumir |
| `db:order-nummer:set` | Resetea la secuencia al valor indicado (usado por `Inställningar > Order-config`) |
| `db:projekt:list-fas-tree` | (en `projekt.ts`) Devuelve todas las fases con sus subfases de todos los förslag de un projekt — usado por `OrderForm` para el selector cascading |

`recomputeOrderTotals(order_id)` se invoca desde el backend tras cualquier cambio en rader. Calcula netto/moms (25%)/total y los actualiza en `ordrar`.

## Tipos

Archivo: `src/renderer/src/sections/order/types.ts`

- `Order` — registro de la cabecera (incluye opcional `projekt` con join)
- `OrderRad` — una línea
- `OrderWithRader` — `Order & { rader: OrderRad[] }`
- `OrderStatus` — `'Utkast' | 'Skickad' | 'Godkänd' | 'Avvisad'`
- `CreateOrderInput`, `CreateOrderRadInput`
- `STATUS_FARG` — mapping status → `{ dot, text }` con clases tailwind del sistema

## Componentes

Todos en `src/renderer/src/sections/order/`

| Archivo | Responsabilidad |
|---|---|
| `OrderSection.tsx` | Orchestrator: list / create / detail. Único que llama a IPC. |
| `OrderTable.tsx` | Lista con `OrderStatusPicker` por fila. Bajar de Godkänd pide confirmación y limpia firma vía `db:order:set-status`. |
| `OrderStatusPicker.tsx` | Dropdown reutilizable con el mismo patrón visual que `ProjektTable.StatusPicker` (botón + popup absolute con dot+texto coloreado). Cuando status=Godkänd: si hay `onRequestUnlock` el chip es clickable para iniciar el desbloqueo, si no es estático. |
| `OrderForm.tsx` | Crear: select projekt → autorelleno kund, fas + subfas (cascading desde `db:projekt:list-fas-tree`), titel, beskrivning, rader inline con cálculo en vivo de netto/moms/total. El campo `beskrivning` de cada rad usa `MaterialAutocompleteInput` para buscar en el catálogo de materiales. |
| `MaterialAutocompleteInput.tsx` | Input controlado + dropdown debounced (250ms) que llama a `db:material-katalog:search`. Al elegir un material autorrellena beskrivning + enhet + a_pris. Soporta navegación con teclado (↑↓ Enter Esc). |
| `OrderDetail.tsx` | Vista flat full-width (px-8, grid-cols-3, separadores `border-b border-border`). `OrderStatusPicker` en cabecera. Botón Begär signatur (modal canvas) y Ta bort. Cuando la order es Godkänd, el chip es clickable para iniciar el desbloqueo (con confirmación). Panel de godkännande con imagen de la firma cuando `Godkänd`. |
| `OrderSignaturePad.tsx` | Modal con `<canvas>` para firma (mouse + touch). Genera base64 PNG (`canvas.toDataURL('image/png')`) y lo envía con el nombre del firmante a `db:order:sign`. |

## Flujo

```
Utkast  ──Skicka──▶  Skickad  ──Begär signatur──▶  Godkänd
                       │
                       └─Avvisa──▶  Avvisad
```

1. Crear order desde la pestaña **Order** (botón **Ny order**) → seleccionar projekt → titel + descripción + rader.
2. Backend crea con `status = Utkast` y nº `O-NNNN`.
3. **Skicka** → status `Skickad` (señaliza que está esperando aprobación del cliente).
4. **Begär signatur** → modal canvas → cliente firma con dedo/ratón + escribe su nombre → `Bekräfta godkännande`. Status pasa a `Godkänd`, se guarda imagen base64 + nombre + fecha.
5. Alternativa: **Avvisa** → status `Avvisad`.
6. Una order `Godkänd` o `Avvisad` queda bloqueada para nuevas firmas (botones ocultos).

## Decisiones de diseño

- **Snapshot del cliente** en `kund_namn` / `kund_org_nr`: si el cliente cambia datos después, la order conserva los datos del momento de creación.
- **Firma como base64 PNG** dentro de la propia tabla: simple, sin dependencia de Storage. Una firma típica pesa ~5–20 KB.
- **Sin sincronización con Fortnox**: una order no es una factura. Si el cliente acepta y se ejecuta el trabajo, la facturación se hace después en Fortnox de forma independiente.

## Inställningar

Panel: `Inställningar > Moduler > Order-config` (`src/renderer/src/sections/installningar/panels/OrderPanel.tsx`).

- **Ordernumrering**: peek + set + reset a 1.
- **Statusar**: lista read-only de los 4 (`Utkast`, `Skickad`, `Godkänd`, `Avvisad`). No editables porque están atados al CHECK constraint y al flujo de firma.

## PDF

**Plantilla** (`src/renderer/src/pdf/defaultOrderTemplate.ts`):
- `DEFAULT_ORDER_HTML` — A4 de una sola página: header empresa, título O-NNNN + titel, info kund/projekt/fas/subfas, beskrivning, tabla rader, totales, bloque firma, villkor opcional. **Sin portada** (Order es un documento interno corto, no necesita cover).
- `buildOrderRaderHtml(rader, valuta)` — genera la `<table>` HTML de las rader

**Configuración** (`Inställningar > System > PDFs`): pestaña **Order** junto a Förslag. Edita la mall en BD (`pdf_mallar.typ='order'`):
- Utseende: accent_farg (logotyp se carga centralmente desde `Företagsinformation`)
- Innehåll: F-skatt, villkor (signatur se muestra automáticamente si la order está Godkänd)
- Botón Förhandsgranska genera un PDF con datos mock

**Exportar** (`OrderDetail`): botón **Exportera PDF** en el header. Carga `db:pdf-mall:get('order')`, construye vars con datos reales (incluyendo imagen de la firma si Godkänd) e invoca `pdf:generate-html` con `save:true`. Filename: `order-O-NNNN.pdf`.

## Pendiente / extensiones futuras

- Generar PDF firmado para enviar al cliente por e-post (integrable con módulo `pdf` y `epost`).
- Trigger workflows desde `OrderDetail` (`WorkflowTriggerBar` ya disponible).
- Push de la order como utkast a Fortnox cuando se firma.
- Edición de rader desde `OrderDetail` (actualmente solo se editan al crear).
