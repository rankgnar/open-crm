# Módulo: Fakturering

Planificación de etapas de facturación generadas a partir de un Förslag. Sirve como calendario de cuándo se facturará cada parte del proyecto.

> Las fakturas reales se emiten desde **Fortnox**, no desde la app. Este módulo solo guarda el **plan** (snapshot inmutable con las etapas, montos por etapa y fechas de vencimiento).

## Base de datos

Tabla: `fakturering_snapshots` · Migraciones: `supabase/migrations/20260420270000_create_fakturaplan_snapshots.sql` (creación original) + `supabase/migrations/20260429120000_rename_fakturaplan_to_fakturering.sql` (rename)

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| projekt_id | uuid | FK `projekt(id)` ON DELETE CASCADE |
| forslag_id | uuid | FK `forslag(id)` ON DELETE CASCADE, **UNIQUE** (1 plan por förslag) |
| forslag_nummer | text | snapshot del nº de förslag |
| forslag_titel | text | snapshot del título |
| total_arbete | numeric | desglose de cálculo |
| total_material | numeric | desglose |
| total_ue | numeric | desglose |
| total_netto | numeric | suma neta |
| rot_eligible | numeric | base para ROT (si aplica) |
| rot_avdrag | numeric | ROT calculado total |
| moms_totalt | numeric | IVA calculado total |
| att_betala_totalt | numeric | total a pagar tras ROT + IVA |
| etapper | jsonb | array `FaktureringEtapp[]` |
| skapad_at | timestamptz | auto |

`etapper[i]` — campos: `pct`, `beskrivning`, `forfall_date`, `netto`, `rot`, `moms`, `att_betala`.

## IPC

Handler: `src/main/ipc/fakturering.ts` · Registrado en: `src/main/index.ts`

| Canal | Acción |
|---|---|
| `db:fakturering:list` | Lista todos los snapshots, orden desc por `skapad_at` |
| `db:fakturering:list-by-projekt` | Lista snapshots de un proyecto (consumido por `ProjektDetail`) |
| `db:fakturering:get` | Obtiene un snapshot por `id` |
| `db:fakturering:generate` | Genera/reemplaza el plan para un förslag (upsert por `forslag_id`) |
| `db:fakturering:delete` | Borra un snapshot |

`generate` recibe `(forslag_id, etapper[])` con `etapper = [{ pct, beskrivning, forfall_date }]`. Calcula totales desde `forslag_arbetskostnad/material/underentreprenorer` y persiste el snapshot.

## Tipos

Archivo: `src/renderer/src/sections/fakturering/types.ts`

- `FaktureringSnapshot` — registro completo
- `FaktureringEtapp` — una etapa dentro del array `etapper`

## Componentes

Todos en `src/renderer/src/sections/fakturering/`

| Archivo | Responsabilidad |
|---|---|
| `FaktureringSection.tsx` | Orchestrator — vista `list` (tabla con etapas expandibles) o `create` (wizard) |
| `FaktureringWizard.tsx` | Wizard 2 pasos: 1) elegir förslag y ver totales 2) definir etapas con % y fechas |

## Flujo

1. Usuario abre pestaña **Fakturering** → ve lista de planes existentes.
2. Click en row → expande etapas con desglose ROT/Moms/Att betala.
3. **Ny fakturering** → wizard:
   - Step 1: filtra por kund → selecciona förslag → app calcula totales (arbete + material + UE + ROT)
   - Step 2: define etapas (% suma exactamente 100), descripción y fecha de vencimiento por etapa
   - **Spara fakturering** → llama `db:fakturering:generate` y vuelve a la lista
4. El plan aparece en `ProjektDetail` (panel derecho).

## Notas

- 1 förslag = 1 plan (constraint UNIQUE en `forslag_id`). Re-generar reemplaza el plan anterior.
- El plan **no crea fakturas**. Las fakturas se crean en Fortnox cuando llega el momento de facturar cada etapa.
- Si el proyecto/förslag se borra, el plan se borra en cascada.
