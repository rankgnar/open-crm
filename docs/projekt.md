# Módulo: Projekt

## Propósito

Gestión de proyectos. Cada proyecto pertenece a un cliente (kund). Tiene estado, fechas y presupuesto.

## Tabla: `projekt`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | auto |
| `projekt_nummer` | TEXT UNIQUE | formato `P-0001`, auto-generado vía sequence |
| `kund_id` | UUID NOT NULL FK | → `kunder(id)` ON DELETE CASCADE |
| `namn` | TEXT NOT NULL | nombre del proyecto |
| `beskrivning` | TEXT | descripción opcional |
| `status` | TEXT CHECK | `planering` (default) · `aktiv` · `pausad` · `klar` · `avbruten` |
| `startdatum` | DATE | nullable |
| `slutdatum` | DATE | nullable |
| `budget_total` | NUMERIC(12,2) | default 0 |
| `skapad_at` | TIMESTAMPTZ | auto |
| `uppdaterad_at` | TIMESTAMPTZ | auto vía trigger `update_updated_at()` |

Migración: `supabase/migrations/20260419150000_create_projekt.sql`

## Secuencia

`projekt_nummer_seq` — funciones: `nextval_projekt_nummer()`, `peek_projekt_nummer()`

## IPC Handlers (`src/main/ipc/projekt.ts`)

| Canal | Descripción |
|---|---|
| `db:projekt:list` | Lista todos con JOIN a `kunder(namn, kundnummer)`, orden desc |
| `db:projekt:list-by-kund` | Lista proyectos de un `kund_id` específico |
| `db:projekt:get` | Obtiene uno por id con JOIN a kunder |
| `db:projekt:preview-nummer` | Peek del próximo projekt_nummer sin consumir |
| `db:projekt:create` | Crea con auto-numeración si no se provee |
| `db:projekt:update` | Actualiza por id |
| `db:projekt:delete` | Elimina por id |

## Componentes (`src/renderer/src/sections/projekt/`)

- `types.ts` — `ProjektStatus`, `Projekt`, `ProjektWithKund`, `CreateProjektInput`, `UpdateProjektInput`
- `ProjektSection.tsx` — root, carga `db:projekt:list` + `db:kunder:list` en paralelo al montar
- `ProjektTable.tsx` — tabla con columnas Nr, Kund, Projektnamn, Status, Startdatum, Slutdatum, Budget
- `ProjektForm.tsx` — dos columnas sin scroll; selector nativo de kund (`kundnummer — namn`)
- `ProjektDetail.tsx` — vista detalle con editar y eliminar

## Colores de estado

| Status | Color |
|---|---|
| `planering` | `text-blue-400` |
| `aktiv` | `text-emerald-400` |
| `pausad` | `text-amber-400` |
| `klar` | `text-muted` |
| `avbruten` | `text-red-400` |

## Siguiente paso

Integrar lista de projekts en `KundDetail` vía `db:projekt:list-by-kund`.
