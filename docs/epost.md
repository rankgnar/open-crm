# Módulo E-post

Gestión completa de correo: lectura/envío via Zoho, alias múltiples, plantillas con variables y adjuntos. Diseñado como base para futuros envíos programados y nodos de workflow.

## Entidades

- **epost_alias** — remitentes seleccionables (sincronizables desde Zoho `sendMailDetails`)
- **epost_mallar** — plantillas con variables `{{...}}` y alias por defecto opcional
- **epost_ko** — cola de envíos programados / en proceso / fallidos

## Flujo

```
Compose → IPC db:epost:send con { alias_id, mall_id?, refs?, bilagor[] }
   ↓
loadAlias()           — carga alias o el standard
applyMall()           — interpola variables si hay mall_id
sendEpost()           — Zoho /api/accounts/{id}/messages con fromAddress = alias.fran_adress
```

Si la plantilla tiene `alias_id` propio, ese alias se usa en lugar del seleccionado en compose. La firma del alias se anexa automáticamente al final del cuerpo.

## Variables disponibles en plantillas

```
{{foretag_namn}}      {{foretag_email}}     {{foretag_telefon}}    {{foretag_webbadress}}
{{kund_namn}}         {{kund_email}}        {{kund_telefon}}
{{projekt_namn}}      {{projekt_nummer}}
{{offert_nummer}}     {{offert_giltig_till}}
{{faktura_nummer}}
{{datum}}             {{alias_signatur}}
```

Las variables se resuelven al aplicar la plantilla pasando refs (`kund_id`, `projekt_id`, `forslag_id`, `faktura_id`).

## Alias

- Sincronización automática desde Zoho con botón **Synka från Zoho** en Inställningar → E-post alias
- Upsert por `zoho_send_mail_id` (si existe) o por `fran_adress`
- Cada alias permite editar localmente: `etikett`, `signatur_html` (HTML), `aktiv`, `standard`
- Solo un alias puede ser `standard` (constraint UNIQUE)

## Adjuntos

Dos rutas:

1. **Manual desde disco** — `db:epost:pick-and-upload-files` abre dialog, sube cada archivo a Zoho `/messages/attachments` y devuelve refs
2. **Desde buffer** — `db:epost:upload-buffer` recibe `{ filename, buffer, mime, kalla }` (renderer pasa PDF generado, etc.)

## Canales IPC

```
db:epost:sync                     — sync inbox/sent/drafts/trash de Zoho
db:epost:get-content              — body completo de un mensaje
db:epost:send                     — envío unificado (alias + mall + bilagor)

db:epost-alias:list | create | update | delete | set-standard
db:epost-alias:sync-from-zoho     — pulls sendMailDetails

db:epost-mallar:list | create | update | delete
db:epost-mallar:preview           — aplica plantilla con refs y devuelve {amne, kropp_html}

db:epost:pick-and-upload-files    — file picker + upload
db:epost:upload-buffer            — sube buffer ya generado
```

## Plantillas iniciales (seed)

| Namn | Kategori |
|---|---|
| Offert-utskick | Offert |
| Faktura-utskick | Faktura |
| Påminnelse | Faktura |
| Tackmail | Uppföljning |
| Välkommen | Välkommen |

## Cola y envíos programados

`epost_ko` mantiene los correos pendientes/programados:

- **Compose → "Skicka senare"** abre popover con `datetime-local`, default +1h
- IPC `db:epost:queue` interpola plantilla y guarda fila con `status='väntar'`
- **Ticker** en main (`processEpostKo`, cada 60s) busca filas con `schemalagd_till <= now()`, intenta `sendEpost`, marca `skickat` o `misslyckades`
- **Retry**: errores transitorios reintentan hasta 3 veces con +1 min entre intentos. Errores permanentes (400/401/403/404/422) marcan fallido sin reintentar
- **Sidebar Utkorg** muestra `väntar` + `misslyckades` con botones Avbryt y Försök igen

### Adjuntos en programados

Los `EpostBilagaRef` se guardan tal cual en la fila — los archivos ya están subidos a Zoho. Asume que Zoho conserva los uploads suficiente tiempo. Si el envío falla por adjunto caducado, queda visible en Utkorg como `misslyckades` para que el usuario reenvíe.

## Canales IPC adicionales (cola)

```
db:epost:queue                    — encola un envío programado
db:epost-ko:list                  — pendientes + fallidos
db:epost-ko:cancel                — borra una fila pendiente
db:epost-ko:retry                 — re-encola una fallida (forsok=0)
```

## Workflow nodes

Dos nodos de tipo `action` permiten enviar correo desde un workflow:

| Tipo | Función |
|---|---|
| `action:send-epost` | Aplica plantilla y envía vía Zoho de inmediato |
| `action:queue-epost` | Aplica plantilla e inserta en `epost_ko` con `schemalagd_till = now() + N min` |

**Configuración común:**

- `mall_id` — plantilla obligatoria
- `alias_id` — override opcional (si vacío, usa el de la plantilla, o el `standard`)
- `till_source` — `kund_email` (extrae de `collectedData.kunder.email`, vía nodo `data:projekt`) o `manual`
- `till_manual` — sólo cuando `till_source = manual`
- `cc` — opcional
- `bilaga_kalla` — clave en `collectedData` con `EpostBilagaRef[]` (opcional)
- `schemalagd_om_minuter` — sólo en `queue-epost` (default 60)

**Refs para interpolación de variables:** se toman de `collectedData` (`projekt_id`, `kund_id` desde `kunder.id`, `forslag_id` si vino de `action:create-forslag`).

**Output del nodo:** `{ epost_skickad: true, epost_till, epost_amne }` para send; `{ epost_kö_id, epost_till, epost_amne, schemalagd_till }` para queue.

Los helpers `sendEpost / applyMall / resolveContext / loadAlias / loggEpostAnteckning` están exportados desde `src/main/ipc/epost.ts` para uso desde `workflows.ts`.

## Pendiente (futuras fases)

- **PDF on-the-fly** — si una automatización necesita adjuntar Offert/Faktura como PDF, se decidirá si generar al vuelo o introducir una capa de docs guardados. Hoy `bilaga_kalla` requiere refs ya subidas (`db:epost:upload-buffer`).
- **Gmail** — sólo Zoho está implementado en envío; OAuth y panel ya existen.
