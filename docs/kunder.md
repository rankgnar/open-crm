# Módulo: Kunder

Gestión de clientes. Base de todo el sistema — un cliente tiene N proyectos.

## Base de datos

Tabla: `kunder` · Migración: `supabase/migrations/20260419120000_create_kunder.sql`

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID | PK, auto |
| namn | TEXT | requerido |
| email | TEXT | nullable |
| telefon | TEXT | nullable |
| adress | TEXT | nullable |
| stad | TEXT | nullable |
| postnummer | TEXT | nullable |
| org_nummer | TEXT | nullable (org o personnummer) |
| status | TEXT | `aktiv` · `inaktiv` · `potentiell` (default) |
| skapad_at | TIMESTAMPTZ | auto |
| uppdaterad_at | TIMESTAMPTZ | auto vía trigger `kunder_updated_at` |

Índice: `idx_kunder_status`

## IPC

Handler: `src/main/ipc/kunder.ts` · Registrado en: `src/main/index.ts`

| Canal | Acción |
|---|---|
| `db:kunder:list` | Lista todos, orden desc por `skapad_at` |
| `db:kunder:get` | Obtiene uno por `id` |
| `db:kunder:preview-nummer` | Devuelve el próximo kundnummer sin consumirlo (`K-XXXX`) |
| `db:kunder:create` | Crea — auto-genera `kundnummer` vía sequence si no se provee |
| `db:kunder:update` | Actualiza por `id`, devuelve actualizado |
| `db:kunder:delete` | Elimina por `id`, devuelve void |

## Tipos

Archivo: `src/renderer/src/sections/kunder/types.ts`

- `Kund` — interfaz completa del registro
- `KundStatus` — union type de los 3 estados
- `CreateKundInput` — campos para crear (namn requerido, resto opcional)
- `UpdateKundInput` — `Partial<CreateKundInput>`

## Componentes

Todos en `src/renderer/src/sections/kunder/`

| Archivo | Responsabilidad |
|---|---|
| `KunderSection.tsx` | Root: estado global + llamadas IPC + navegación interna |
| `KunderTable.tsx` | Tabla presentacional — recibe `kunder[]` por props |
| `KundForm.tsx` | Form crear/editar — estado local, submit delega al padre |
| `KundDetail.tsx` | Vista detalle — editar (reutiliza KundForm) + eliminar con confirmación |

## Navegación interna

`KunderSection` gestiona `view: 'list' | 'create' | 'detail'` y `selectedKund`.
Sin router — todo por estado local.
