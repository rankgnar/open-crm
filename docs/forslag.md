# Förslag

Módulo de propuestas comerciales. Estructura jerárquica de 3 niveles con cálculo de costes en tiempo real y soporte para ROT-avdrag.

## Jerarquía de datos

```
Förslag
  └── Fas (ej. "Rivning", "Installation")
        └── Subfas (ej. "Elinstallation", "VVS")
              ├── Arbetskostnad  — filas de mano de obra
              ├── Materialkostnad — filas de materiales
              └── Underentreprenörer — empresas externas (VVS, EL, Transport...)
```

## Tablas

| Tabla | FK | Descripción |
|---|---|---|
| `forslag` | `projekt_id` | Propuesta vinculada a un proyecto |
| `forslag_faser` | `forslag_id` | Fases de la propuesta |
| `forslag_subfaser` | `fas_id` | Subfases dentro de cada fase |
| `forslag_arbetskostnad` | `subfas_id` | Mano de obra por subfase |
| `forslag_materialkostnad` | `subfas_id` | Materiales por subfase |
| `forslag_underentreprenorer` | `subfas_id` | Subcontratas por subfase |

Migraciones:
- `supabase/migrations/20260419190000_create_forslag.sql` — tablas base
- `supabase/migrations/20260419200000_add_subfaser.sql` — añade subfaser, mueve arbete/material a subfas_id
- `supabase/migrations/20260419210000_add_underentreprenorer.sql` — reemplaza subkontraktorer con underentreprenorer

## Numeración automática

Secuencia `forslag_nummer_seq` → `F-0001`, `F-0002`...
RPC `peek_forslag_nummer()` previsualiza sin consumir.

## UI — 4 columnas

```
┌──────────┬──────────┬─────────────────────────────┬──────────────┐
│  FASER   │ SUBFASER │  ARBETE + MATERIAL + UE      │  KOSTNADS   │
│  w-44    │  w-44    │  flex-1                      │  PANEL w-72 │
│  [✦ AI]  │  [✦ AI]  │                              │             │
│          │          │  Arbetskostnad               │  Summering  │
│ ● Fas 1  │ ● Sub 1  │  Materialkostnad             │  ROT/Moms   │
│ ○ Fas 2  │ ○ Sub 2  │  Underentreprenörer          │  TOTALT     │
│          │  [⛏][📦] │                              │  AI analys  │
└──────────┴──────────┴─────────────────────────────┴──────────────┘
```

- Col 1: lista de faser, rename/delete en hover, botón IA (deshabilitado)
- Col 2: subfaser de la fas seleccionada, botón IA en header + `⛏`(arbete) `📦`(material) por fila
- Col 3: tres tablas inline editables con onBlur + Enter auto-save
- Col 4: cálculo live acumulado de todas las subfaser

## Cálculo de costes (renderer, sin IPC)

```
Total Arbete = Σ (antal_timmar × timpris) todas las subfaser
Total Material = Σ (antal × a_pris) todas las subfaser
Total UE = Σ kostnad todas las subfaser

Subtotal = Arbete + Material + UE

ROT-avdrag (si projekt.rot_avdrag):
  Arbete ROT = Σ (timmar × timpris) donde rot_berattigad = true
  Avdrag = Arbete ROT × (rot_procent / 100)
  Cap: 50 000 SEK (una persona) / 100 000 SEK (con rot_inkludera_medsokande)

Netto  = Subtotal − ROT-avdrag
Moms   = Netto × (moms_procent / 100)
TOTALT = Netto + Moms
```

## Canales IPC

| Canal | Acción |
|---|---|
| `db:forslag:list` | Lista con JOIN projekt+kund |
| `db:forslag:list-by-projekt` | Por projekt_id |
| `db:forslag:preview-nummer` | Peek F-XXXX |
| `db:forslag:create/update/delete` | CRUD propuesta |
| `db:forslag-faser:list` | Fases de una propuesta |
| `db:forslag-faser:create/update/delete` | CRUD fases |
| `db:forslag-subfaser:list` | Subfases de una fase |
| `db:forslag-subfaser:list-by-forslag` | Todas las subfases de una propuesta |
| `db:forslag-subfaser:create/update/delete` | CRUD subfases |
| `db:forslag-arbete:list-by-forslag` | Todo el arbete de una propuesta |
| `db:forslag-arbete:create` | Nueva fila vacía (arg: subfas_id) |
| `db:forslag-arbete:update/delete` | Actualizar/eliminar fila |
| `db:forslag-material:list-by-forslag` | Todo el material de una propuesta |
| `db:forslag-material:create` | Nueva fila vacía (arg: subfas_id) |
| `db:forslag-material:update/delete` | Actualizar/eliminar fila |
| `db:forslag-ue:list-by-forslag` | Todos los UE de una propuesta |
| `db:forslag-ue:create` | Nueva fila vacía (arg: subfas_id) |
| `db:forslag-ue:update/delete` | Actualizar/eliminar fila |

## Componentes

| Archivo | Responsabilidad |
|---|---|
| `types.ts` | Todos los tipos del módulo |
| `ForslagSection.tsx` | Root: estado + navegación list/create/detail |
| `ForslagTable.tsx` | Lista de propuestas con estado e info de proyecto |
| `ForslagForm.tsx` | Formulario crear/editar (2 columnas, full-height) |
| `ForslagDetail.tsx` | Editor 4 columnas + todos los handlers de estado |
| `FasEditor.tsx` | Tablas inline editables arbete/material/UE, Enter + onBlur guardan |
| `ForslagKostnadsPanel.tsx` | Cálculo live con desglose UE + placeholder AI |

## Estados de propuesta

| Estado | Color |
|---|---|
| `utkast` (Borrador) | gris |
| `skickat` (Enviado) | azul |
| `accepterat` (Aceptado) | verde |
| `avvisat` (Rechazado) | rojo |

## AI — Fase 2

Botones placeholder ya visibles en la UI:
- `✦` en header Faser → generará fases automáticamente
- `✦` en header Subfaser → generará subfases de la fase seleccionada
- `⛏` por subfas → generará filas de arbetskostnad
- `📦` por subfas → generará filas de materialkostnad
- "Analysera projekt" en panel costes → análisis completo de la propuesta

Campo `ai_analys TEXT` ya existe en la tabla `forslag`. Proveedor AI (Claude/GPT/Gemini) por decidir en Fase 2.
