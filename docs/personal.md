# Módulo Personal

Gestión de empleados (anställda). Accesible desde el sidebar bajo "Revisor".

## Entidades

- **personal** — empleado, con datos básicos, salario, y estado aktiv/inaktiv
- **personal_anteckningar** — notas por empleado (igual que projekt)
- **personal_dokument** — documentos en Supabase Storage (bucket `personal-dokument`)
- **personal_ledighet** — registros de vacaciones y ausencias
- **personal_tidrapport** — registros de horas trabajadas

## Funcionalidades

- Lista con búsqueda (namn, personal_nummer, roll, email, personnummer) y filtro por status
- Crear/editar empleado vía formulario de dos columnas
- Vista de detalle con panel izquierdo (info + estadísticas anuales) y panel derecho con 4 tabs:
  - **Anteckningar** — notas con color, edición inline
  - **Dokument** — archivos subidos a Supabase Storage
  - **Tidrapport** — registro de horas (datum, timmar, typ: normal/övertid/jour)
  - **Ledighet** — vacaciones y ausencias (typ, fechas, godkänd)
- Importación CSV desde Fortnox personalregister con deduplicación por `fortnox_id` y `personnummer`

## Numeración

Secuencia `personal_nummer_seq` → formato `EMP-0001`. Funciones RPC: `nextval_personal_nummer`, `peek_personal_nummer`, `setval_personal_nummer`.

## Canales IPC

```
db:personal:list | get | preview-nummer | create | update | delete | import-csv
db:personal-anteckningar:list | create | update | delete
db:personal-dokument:list | upload | delete | open
db:personal-ledighet:list | create | update | delete
db:personal-tidrapport:list | create | delete
```

## Mapeo CSV Fortnox

| Columna CSV | Campo DB |
|---|---|
| Anställnings-ID | fortnox_id |
| Förnamn + Efternamn | namn |
| Personnummer | personnummer |
| Befattning | roll |
| Personaltyp | personaltyp (TJM/ARB) |
| Löneform | loneform (MAN/TIM) |
| Anställningsform | anstallningsform |
| E-post | email |
| Mobiltelefon / Telefon | telefon |
| Postadress / Postnr / Ort | postadress / postnummer / ort |
| Anställd | anstallningsdatum |
| Anställd t.o.m | slutdatum |
| Aktiv | status (1=aktiv) |
| Månadslon | manadslön |
| Timlön | timlön |
| Sysselsättningsgrad (%) | sysselsattningsgrad |
