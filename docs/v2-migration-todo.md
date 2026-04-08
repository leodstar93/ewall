# V2 Migration TODO

Objetivo: migrar la app actual al nuevo estilo `v2` por partes, sin romper negocio, permisos ni flujos productivos.

## Reglas base

- Mantener la lógica de negocio actual en `services/`, `lib/` y APIs.
- Migrar primero presentación, layout y composición de pantallas.
- Evitar reescribir lógica junto con rediseño visual en el mismo paso.
- Hacer cambios por módulo, con rutas o flags controlados.
- Preferir migraciones aditivas antes de reemplazos grandes.
- Cada módulo migrado debe quedar usable en desktop y mobile.

## Estructura objetivo

- `app/v2/`
  - Rutas V2 visibles para pruebas controladas.
- `app/v2/components/`
  - Shell, navegación, tablas, cards, panels, filtros y widgets V2.
- `app/v2/data.ts`
  - Solo temporal; luego debe desaparecer o quedar solo para demos.
- `v2/`
  - Documentación visual, tokens, conceptos de diseño y helpers de transición.
- `components/`
  - Seguirá conteniendo componentes legacy hasta completar la migración.

## Fase 0: Base técnica

- [ ] Definir tokens finales de V2:
  - colores
  - spacing
  - radios
  - tipografía
  - estados
- [ ] Mover variables visuales estables a un solo punto de verdad.
- [ ] Decidir si los componentes V2 vivirán en `app/v2/components` o en una carpeta compartida nueva como `components/v2`.
- [ ] Crear componentes base reutilizables V2:
  - button
  - input
  - select
  - textarea
  - badge
  - card
  - table
  - empty-state
  - page-header
  - stat-card
- [ ] Definir layout shell V2 definitivo:
  - sidebar
  - topbar
  - content container
  - responsive behavior
- [ ] Eliminar mocks de `app/v2/data.ts` a medida que cada pantalla use datos reales.

## Fase 1: Adaptadores de migración

- [ ] Crear una estrategia para reutilizar lógica vieja con UI nueva:
  - contenedores que cargan datos existentes
  - componentes V2 solo de presentación
- [ ] Separar en cada pantalla:
  - carga de datos
  - acciones
  - vista
- [ ] Detectar componentes legacy que mezclan demasiada lógica + UI.
- [ ] Extraer helpers compartidos donde haga falta antes de migrar vistas complejas.

## Fase 2: Shell principal

- [ ] Migrar primero el shell general del dashboard al layout V2.
- [ ] Conectar sidebar V2 con navegación real y permisos reales.
- [ ] Conectar topbar V2 con:
  - usuario
  - breadcrumbs
  - notificaciones
  - búsqueda o comando global si aplica
- [ ] Sustituir placeholders del shell por datos reales de sesión.
- [ ] Validar colapso de sidebar, estados activos y navegación móvil.

## Fase 3: Shared UI

- [ ] Migrar tablas legacy a una tabla V2 reutilizable.
- [ ] Migrar formularios comunes a inputs V2.
- [ ] Migrar badges de estado y colores de estado.
- [ ] Migrar cards de resumen y métricas.
- [ ] Migrar paginación, filtros y empty states.
- [ ] Crear variantes de loading/skeleton V2.

## Fase 4: Orden sugerido de módulos

Orden recomendado por impacto y riesgo:

1. Dashboard / Settings
2. Documents
3. IFTA v2
4. DMV
5. UCR
6. Form 2290
7. Users / profile
8. Admin
9. Public site

## Módulo 1: Dashboard / Settings

- [ ] Rehacer `/settings` con shell V2 real.
- [ ] Migrar tabs y paneles de settings al sistema V2.
- [ ] Conectar company info, profile, security e integrations.
- [ ] Validar que permisos y guardas sigan igual.

## Módulo 2: Documents

- [ ] Rehacer listado de documentos en layout V2.
- [ ] Mantener descarga, preview y filtros actuales.
- [ ] Diseñar estados:
  - vacío
  - cargando
  - error
  - resultados
- [ ] Validar que links a archivos y permisos funcionen igual.

## Módulo 3: IFTA v2

- [ ] Migrar primero la lista de filings.
- [ ] Después migrar detalle de filing.
- [ ] Después migrar acciones:
  - manual fuel
  - submit
  - start review
  - request changes
  - approve
- [ ] Mantener visible:
  - exceptions
  - audit trail
  - snapshots
  - estados de workflow
- [ ] No tocar modelos legacy de IFTA.

## Módulo 4: DMV

- [ ] Migrar dashboard/listado de registros.
- [ ] Migrar renewals y detalle.
- [ ] Rehacer requirements/review panels con cards V2.
- [ ] Validar todas las acciones de staff y cliente.

## Módulo 5: UCR

- [ ] Migrar lista de filings.
- [ ] Migrar detalle con timeline y documentos.
- [ ] Mantener checkout, resubmit, approve y review.

## Módulo 6: Form 2290

- [ ] Migrar dashboard/listado.
- [ ] Migrar detalle y flujo de submit.
- [ ] Mantener uploads y estados del filing.

## Módulo 7: Users / Profile

- [ ] Migrar perfil de usuario.
- [ ] Migrar gestión de cuentas, roles y permisos visibles en UI.
- [ ] Mantener toda la lógica RBAC sin cambios.

## Módulo 8: Admin

- [ ] Migrar dashboard admin.
- [ ] Migrar truckers, users, roles y permissions.
- [ ] Migrar billing settings admin.
- [ ] Migrar sandbox solo al final.

## Módulo 9: Public site

- [ ] Decidir si la web pública comparte lenguaje V2 o tendrá variante propia.
- [ ] Migrar home y páginas públicas solo cuando el sistema V2 ya esté estable.

## Estrategia por pantalla

Para cada pantalla:

- [ ] Identificar ruta actual.
- [ ] Identificar fuente de datos y permisos.
- [ ] Crear versión V2 usando datos reales.
- [ ] Comparar comportamiento contra la pantalla legacy.
- [ ] Validar responsive.
- [ ] Validar estados vacíos/error/loading.
- [ ] Validar acciones críticas.
- [ ] Solo entonces reemplazar o redirigir.

## Estrategia de reemplazo

- [ ] Opción A: mantener rutas actuales y reemplazar internamente la UI.
- [ ] Opción B: crear rutas V2 paralelas y luego hacer swap.
- [ ] Recomendación:
  - usar V2 paralela en módulos complejos
  - reemplazo directo en pantallas simples

## Checklist de cada PR

- [ ] No mover lógica de negocio a la capa visual.
- [ ] No romper permisos ni guardas.
- [ ] No romper mobile.
- [ ] No dejar imports legacy innecesarios.
- [ ] No dejar mocks si la pantalla ya usa datos reales.
- [ ] Probar navegación completa de la pantalla migrada.

## Definición de terminado

La migración estará lista cuando:

- [ ] el shell V2 sea el shell principal
- [ ] los módulos críticos operen con datos reales y UI V2
- [ ] no dependamos de `app/v2/data.ts` para pantallas productivas
- [ ] los componentes legacy principales queden sin uso
- [ ] podamos retirar el shell viejo con bajo riesgo

## Próximo paso recomendado

- [ ] Empezar por `settings` como primer módulo real conectado a datos verdaderos.
- [ ] Después migrar `documents`.
- [ ] Luego entrar a `ifta-v2`, que es el módulo más importante del negocio.
