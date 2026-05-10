# Ekonomi

Control económico por proyecto: Budget estimado → Förslag pris → Utfall real → Resultado.

## Flujo de datos

```
Budget total (projekt.budget_total)   ← estimación al crear el proyecto
      ↓
Förslag pris (calculado del förslag aceptado)  ← presupuesto oficial al cliente
      ↓
Utfall (costes reales registrados manualmente)  ← lo que se gasta
      ↓
Resultado = Förslag pris − Utfall  ← margen
```

## Tabla

| Tabla | Descripción |
|---|---|
| `ekonomi_utfall` | Entradas de coste real por proyecto |

Campos: `id, projekt_id FK, kategori, beskrivning, belopp, datum, skapad_at, tidrapport_id, fortnox_givennumber`

Categorías: `arbete` · `material` · `ue` · `övrigt`

Migraciones:
- `20260419220000_create_ekonomi.sql` — tabla base
- `20260425140000_add_tidrapport_ref_to_ekonomi.sql` — referencia a tidrapport
- `20260426120000_add_fortnox_givennumber_to_ekonomi.sql` — referencia a Lev.faktura de Fortnox

## Cálculo del Förslag pris

Se carga el förslag con status `accepterat` del proyecto (o el más reciente si no hay ninguno aceptado). Se suma toda la jerarquía (arbete + material + UE de todas las subfaser), se aplica ROT-avdrag si corresponde y se añade el moms. Es el mismo cálculo que `ForslagKostnadsPanel`.

## Semáforo en la lista

| Color | Condición |
|---|---|
| Verde | Utfall < 80% del budget |
| Ámbar | Utfall entre 80–100% del budget |
| Rojo | Utfall > budget |

## Canales IPC

| Canal | Acción |
|---|---|
| `db:ekonomi-utfall:list` | Utfall de un proyecto (por projekt_id) |
| `db:ekonomi-utfall:list-all` | Todos los utfall (para vista lista) |
| `db:ekonomi-utfall:create` | Nueva entrada |
| `db:ekonomi-utfall:update` | Actualizar |
| `db:ekonomi-utfall:delete` | Eliminar |
| `db:ekonomi-utfall:list-fortnox-givennumbers` | Set de GivenNumber ya importados (badge "Importerad") |
| `db:ekonomi-utfall:create-from-fortnox` | Inserta utfall en batch desde Lev.fakturor seleccionadas |

## Componentes

| Archivo | Responsabilidad |
|---|---|
| `types.ts` | `EkonomiUtfall`, `CreateUtfallInput`, `UtfallKategori` |
| `EkonomiSection.tsx` | Root: carga projekt + utfall, gestiona estado |
| `EkonomiTable.tsx` | Lista de proyectos con semáforo y totales |
| `EkonomiDetail.tsx` | Vista detalle: 4 stats + barra progreso + registro utfall |

## Integración Fortnox → Kostnader

En la pestaña **Fortnox → Lev.fakturor** se pueden seleccionar varias facturas de proveedor con checkbox y enviarlas a un proyecto como utfall mediante el botón **Skicka till projekt**. El modal pide proyecto y categoría; el `belopp` se calcula como `Total − VAT` (neto, sin IVA), `datum` viene de `InvoiceDate` y `beskrivning` se rellena con `"{SupplierName} — {InvoiceNumber}"`.

La columna `fortnox_givennumber UNIQUE` en `ekonomi_utfall` evita duplicados al re-importar. Las facturas ya enviadas muestran el badge **Importerad** y no son seleccionables.

## Integraciones futuras

- App móvil de empleados
- Fakturor (módulo interno)
