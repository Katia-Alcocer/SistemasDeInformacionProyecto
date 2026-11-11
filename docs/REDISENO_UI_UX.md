# Rediseño UI/UX de Guardería infantil

Fecha: 28 de octubre de 2026.

## Alcance

Se actualizó la capa visual común de la SPA React/Vite y la estructura compartida de navegación. Los módulos conservan sus rutas, permisos, campos, validaciones, llamadas a API y operaciones de negocio. No se añadieron datos ni acciones ficticias a las vistas.

## Auditoría inicial

- El frontend tenía una hoja de estilos global muy compacta, sin tokens ni puntos de quiebre responsivos.
- La navegación aparecía como una fila superior de enlaces y enlaces adicionales bajo el encabezado, con los módulos repartidos entre varios bloques.
- Las pantallas compartían un tratamiento básico de secciones, controles y tablas; no había jerarquía visual consistente ni variante para acciones delicadas.
- Formularios extensos, tablas, estados vacíos, carga y mensajes dependían de los mismos estilos mínimos.
- El proyecto no tenía biblioteca visual externa ni componente de botón reutilizable. Se conservó React/Vite y no se añadieron dependencias.

## Identidad visual y sistema de diseño

Se eligió una interfaz adulta y cálida: fondo azul grisáceo claro, paneles blancos, verde menta como color principal, y acentos suaves en azul, amarillo y lavanda. Las decoraciones infantiles se limitan a la marca floral y a formas abstractas en el login.

Tokens principales definidos en frontend/src/app.css:

- Tinta #203247, texto secundario #65758b, fondo #f5f8fb.
- Verde principal #287c70 y su variante oscura #1e655c.
- Panel blanco, borde #e2e9ef, radio común de 18 px y sombra tenue.
- Tipografía del sistema, con preferencia por Inter si está instalada; no depende de fuentes remotas.
- Foco visible, controles de al menos 44 px, radios y espaciados coherentes, transiciones cortas y respeto a prefers-reduced-motion.

## Componentes y navegación

- Se creó frontend/src/Button.jsx con variantes primary, secondary, outline, ghost, danger y success; tamaños sm/md/lg; icono opcional, tipo explícito, disabled y estado loading accesible.
- Se emplea en login, cierre de sesión y operaciones de anulación/suspensión. Los botones nativos restantes conservan sus eventos y reciben la misma base visual global.
- Se reorganizó frontend/src/routes/AppRouter.jsx en una barra lateral agrupada por jornada, personas, aulas/cuidado y administración. Los enlaces se filtran con los mismos roles ya asignados a cada ruta.
- Se añadió navegación móvil desplegable, cierre por fondo, marca de sección, rol de la sesión, acceso para saltar al contenido y navegación por teclado con foco visible.
- El dashboard ofrece accesos directos a rutas reales autorizadas; no muestra métricas inventadas.

## Interfaces cubiertas por los estilos compartidos

El nuevo marco y la hoja global se aplican a login, dashboard y todos los módulos existentes:

- Personal y grupos.
- Expedientes, documentos, tutores/autorizados y preinscripciones.
- Recepción, salidas, avisos y revisiones de retardo.
- Aula, actividades, inventario y medicamentos.
- Comedor y recetas/restricciones.
- Enfermería, mediciones y recolección urgente.
- Finanzas y pagos.
- Reportes internos de autoridad.

Se mejoraron tarjetas, artículos de detalle, tablas desplazables, formularios, campos, checkboxes, fieldsets, botones, mensajes de error/confirmación, estados vacíos, login y pantalla 404. La navegación del módulo se consolidó en el sidebar; los accesos rápidos del dashboard se conservan como atajos intencionales.

## Accesibilidad y adaptación

- El login conserva etiquetas asociadas mediante etiquetas contenedoras y nombres comprensibles.
- Se incorporaron regiones main/nav etiquetadas, enlace “Saltar al contenido”, foco visible y estados de carga anunciados.
- Los iconos de navegación son decorativos para tecnología asistiva; el texto del enlace conserva el nombre accesible.
- En tablet y móvil la barra lateral pasa a menú desplegable; los formularios pasan a una columna y las tablas quedan dentro de contenedores con desplazamiento horizontal.
- Hay puntos de adaptación en 1100 px, 760 px y 420 px.
- La hoja respeta movimiento reducido. No se ha completado una auditoría formal WCAG 2.2 AA ni una revisión con lector de pantalla.

## Verificación

- npm test: 48 de 48 pruebas pasaron (13 archivos de prueba).
- npm run lint: pasó.
- npm run build: pasó; Vite mostró avisos de directivas use client ignoradas al agrupar React Router.
- El navegador gráfico no estuvo disponible en la herramienta de revisión; por ello no se afirma que se haya realizado inspección visual manual en varios tamaños.
- Las pruebas cubren autenticación y permisos junto con flujos de los módulos, pero no sustituyen una inspección visual de todas las pantallas.

## Vistas y funciones sin pagina independiente

- No hay un dashboard con estadisticas agregadas; se conservaron accesos reales y no se inventaron indicadores.
- Tutores/autorizados, documentos y auditoria del expediente se consultan desde Expedientes; no son rutas de navegacion separadas.
- No existe una vista general para recorrer toda la auditoria. La exportacion disponible esta dentro del expediente y el reporte administrativo/autoridad se abre en paginas imprimibles.
- Los roles son los cuatro perfiles existentes; no hay una pantalla independiente de CRUD para crear roles.
- No se agregaron interfaces para HBS, envio oficial al DIF, biometria, pagos externos ni aplicaciones moviles, que no forman parte de la implementacion actual.
## Pendientes

- Revisar manualmente el dashboard y cada módulo en escritorio, tablet y móvil en un navegador visible.
- Completar una revisión WCAG 2.2 AA con teclado y lector de pantalla.
- Continuar migrando botones nativos a Button donde aporte variantes explícitas, conservando el tipo submit/reset/button de cada flujo.
- Revisar con responsables del centro la marca y el tono visual antes de publicarlo fuera del entorno local.
