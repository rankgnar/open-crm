# Inställningar

Panel central de configuración del sistema. Cubre empresa, defaults de módulos, catálogos de datos e integraciones externas.

## Layout

2 columnas: nav izquierda (w-52) con grupos y items, panel derecho con el contenido. Auto-save on blur — sin botón guardar explícito.

## Grupos y Paneles

| Grupo | Panel | Descripción |
|---|---|---|
| Allmänt | Företag | Nombre, org.nummer, dirección, contacto, bankgiro |
| Allmänt | Utseende | Toggle dark/light theme |
| Moduler | Kunder | Default land, landskod, status |
| Moduler | Projekt | Default betalningsvillkor, rot_procent |
| Moduler | Förslag | Default moms%, giltig_dagar, ROT-avdrag caps |
| Moduler | Fakturor | Default betalningsvillkor (días), konto, moms% |
| Moduler | Ekonomi | ROT-avdrag tak enkel/dubbel (SEK) |
| Bibliotek | Yrkesroller | Catálogo de roles con timpris — tabla inline CRUD |
| Bibliotek | Artiklar | Artículos compatibles Fortnox — tabla inline CRUD |
| Bibliotek | Leverantörer | Proveedores — accordion expandible con CRUD |
| Bibliotek | Fas-mallar | Plantillas de fases: 3 cols Mallar → Faser → Subfaser |
| Integrationer | Fortnox | OAuth2 credentials + estado de conexión + botón conectar |
| Integrationer | Google | Placeholder (coming soon) |
| Integrationer | Zoho | Placeholder Calendar + Mail (coming soon) |
| Integrationer | AI (Claude) | Enable toggle, provider, model, api_key |

## Tablas de Base de Datos

| Tabla | Descripción |
|---|---|
| `app_installningar` | Fila única con toda la config global |
| `arbets_roller` | Catálogo de roles con timpris |
| `artiklar` | Artículos compatibles Fortnox |
| `leverantorer` | Proveedores |
| `fas_mallar` | Plantillas de fases |
| `fas_mall_faser` | Fases de cada plantilla |
| `fas_mall_subfaser` | Subfases de cada fase |

Migración: `supabase/migrations/20260419240000_create_installningar.sql`

## AppConfig Context

`src/renderer/src/context/AppConfig.tsx` — carga `app_installningar` al arranque y lo expone via `useAppConfig()` hook. Todos los formularios del sistema consumen este context para sus valores por defecto en lugar de tenerlos hardcodeados.

## Canales IPC

| Canal | Acción |
|---|---|
| `db:installningar:get` | Devuelve la única fila de config |
| `db:installningar:update` | Actualiza campos parciales |
| `db:arbets-roller:list/create/update/delete` | CRUD roles |
| `db:artiklar:list/create/update/delete` | CRUD artículos |
| `db:leverantorer:list/create/update/delete` | CRUD proveedores |
| `db:fas-mallar:list/create/update/delete` | CRUD plantillas |
| `db:fas-mall-faser:list/create/update/delete` | CRUD fases de plantilla |
| `db:fas-mall-subfaser:list/create/update/delete` | CRUD subfases |
| `shell:open-external` | Abre URL en navegador del sistema |

## Integraciones futuras

- **Fortnox**: OAuth2 configurado en panel, botón conectar abre Fortnox en navegador. Tokens almacenados en `app_installningar`.
- **Google Workspace**: MCP disponible en `/home/rankgnar/projects/prod/mcps/MCP-GOOGLE`
- **Zoho**: MCPs en `MCP_ZOHO_CALENDER` y `MCP_ZOHO_MAIL`
- **AI**: Claude via Anthropic API — activado desde panel AI, api_key almacenada en settings
