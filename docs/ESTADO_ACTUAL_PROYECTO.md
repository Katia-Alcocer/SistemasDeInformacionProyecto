# Estado actual del proyecto

Fecha de revisión: 28 de octubre de 2026.

## 1. Estado general

El repositorio contiene una aplicación React/Vite y una API Express con MySQL, autenticación de sesiones JWT en cookie HttpOnly, roles y módulos de operación. La documentación del proyecto registra que S6 comenzó con cuotas semanales, pagos parciales y comprobantes imprimibles. En esta intervención se añadieron las prórrogas en Finanzas y el aviso informativo de adeudos en recepción.

La revisión confirma rutas, servicios, componentes y pruebas para S1–S6. En esta sesión comprobé API y MySQL conectados, OpenAPI activo 4.5.0 con auditoría y reporte imprimible, frontend HTTP 200, 142/142 pruebas de integración y 48/48 pruebas de UI. Las migraciones 011–012 están registradas en `mysql-test` y en la base de desarrollo; ambas conservan 43 tablas. Frontend/backend compilan y las dos suites ESLint pasan. No se ha verificado respaldo/restauración ni rendimiento.

## 2. Entregas

| Entrega | Estado observado | Evidencia en el repositorio | Verificación de esta sesión |
|---|---|---|---|
| S1 | Implementada; documentación previa registra pruebas | Auth, usuarios, grupos, OpenAPI y pruebas de integración | No ejecutada |
| S2 | Implementada; documentación previa registra pruebas | Menores, preinscripciones, tutores, documentos y pruebas de integración | No ejecutada |
| S3 | Implementada; documentación previa registra pruebas | Recepción, recetas, inspecciones, insumos y pruebas de integración | No ejecutada |
| S4 | Implementada; documentación previa registra pruebas | Aula, medicamentos, comedor, insumos y suites correspondientes | No ejecutada |
| S5 | Implementada; documentación previa registra pruebas | Enfermería, salidas, retardos, aprobaciones y reportes de autoridad | No ejecutada |
| S6 | Parcial; finanzas, reportes, auditoría y correcciones implementadas; pruebas ejecutadas | Finanzas, expedientes, EJS, migraciones y suites | 142/142 backend, 48/48 UI; migraciones aplicadas en desarrollo y pruebas; respaldo/rendimiento pendientes |

El README raíz conserva resultados históricos de ejecución y despliegue de etapas anteriores. Se reportan allí como evidencia documentada previa, no como resultados repetidos en esta revisión.

## 3. Funcionalidades existentes

- Inicio/cierre de sesión, autorización por roles y administración de personal y grupos.
- Expedientes, preinscripciones, autorizados y manejo privado de documentos.
- Recepción con filtro médico, inspección, insumos y asistencia.
- Aula, actividades, medicamentos con programación persistente, comedor e inventario.
- Enfermería, salidas, avisos de retardo, revisiones de justificación y reportes internos imprimibles.
- Cuotas manuales semanales, saldos exactos en centavos, pagos parciales, comprobantes EJS, prórrogas auditadas y anulación de pagos con motivo, actor/hora, idempotencia y recálculo de saldo; el comprobante original se conserva.
- Descarga JSON de auditoría del expediente y reporte HTML imprimible para ADMIN. El reporte incluye datos administrativos y metadatos documentales, enmascara parcialmente la CURP y no incluye archivos, rutas ni hashes privados.

## 4. Funcionalidades pendientes

- Aclarar y versionar cualquier corrección financiera adicional que resulte del documento maestro; la anulación de pagos ya está implementada en el código.
- El reporte imprimible administrativo pasó la prueba de integración; falta la revisión manual de presentación.
- Respaldos automáticos/retención, restauración verificada, mediciones de rendimiento y revisión final; el procedimiento manual está en `docs/OPERACION_RESPALDO.md`.
- Verificar en MySQL la consulta de saldos agregados de la ficha de recepción.
- Revisar manualmente flujos, permisos y usabilidad con la aplicación activa.

## 5. Problemas, dependencias y riesgos detectados

- `git status` inicialmente fue bloqueado por la protección de propiedad de Git (“dubious ownership”); el historial se pudo leer con `safe.directory` por comando, sin modificar configuración global.
- Docker Desktop está activo. El CLI requiere ejecución autorizada fuera del entorno aislado; las pruebas se corrieron en contenedores temporales. El backend local fue reiniciado y sirve OpenAPI 4.5.0.
- Las migraciones 011–012 se aplicaron en `mysql-test` y en la base de desarrollo local; se verificaron marcas y columnas y se conservaron 43 tablas. Otras instancias existentes requieren aplicación explícita.
- El documento maestro deja políticas de mora, tarifa/corte semanal y procedimientos de exportación pendientes o ambiguas; no se inventaron reglas para las prórrogas fuera de exigir que extiendan la fecha efectiva y registrar un motivo.
- Los archivos de entorno/accesos no se modificaron ni se incluyeron en los cambios.

## 6. Últimos cambios realizados

- `backend/src/modules/pagos/pagos.validation.js`: esquema estricto para prórrogas.
- `backend/src/modules/pagos/pagos.service.js`, `pagos.repository.js`, `pagos.routes.js`, `backend/src/app.js`: historial, validación de extensión, idempotencia, auditoría y endpoint ADMIN.
- `backend/src/routes/openapi.finanzas.js` y `backend/src/routes/openapi.s3.js`: contrato acumulado actualizado a 4.2.0 con el resumen financiero en ficha de recepción.
- `frontend/src/modules/pagos/Finanzas.jsx` y `frontend/src/modules/recepcion/Recepcion.jsx`: formulario/historial de prórrogas, tabla de saldos vigentes para ADMIN y aviso agregado sin bloqueo en recepción.
- `backend/src/modules/recepcion/recepcion.repository.js`, `recepcion.service.js`, `backend/src/routes/openapi.s3.js`: consulta de saldo pendiente/vencido en fecha operativa.
- `database/migrations/011_prorrogas_idempotencia.sql` y `docker/mysql/Dockerfile`: columnas idempotentes y ejecución para bases nuevas.
- `database/migrations/012_anulacion_pagos.sql`, servicio/repositorio/ruta de pagos y `Finanzas.jsx`: anulación con motivo, actor/hora, auditoría transaccional, clave idempotente separada, saldo recalculado y snapshot de recibo intacto. OpenAPI 4.3.0.
- `backend/src/modules/menores/auditoria.routes.js`, servicio/repositorio de menores, `backend/src/app.js` y `Expedientes.jsx`: exportación JSON de auditoría por menor autorizada solo a ADMIN, con evento de exportación, detalle y sin rutas/hash de archivos privados; reporte HTML imprimible ADMIN con datos administrativos y metadatos, CURP parcial, registro de exportación y sin archivos/rutas privadas. OpenAPI 4.5.0.
- Pruebas de integración y UI para prórrogas, idempotencia, permisos, resumen ADMIN, aviso de adeudo no bloqueante, anulación financiera y exportación de auditoría por menor.
- `README.md`: resumen del incremento y limitación de verificación.

## 7. Próximo paso recomendado

Con las migraciones 011–012 aplicadas y las suites backend/frontend pasando, continuar con el ensayo de restauración en instancia aislada, mediciones p95 de endpoints operativos y revisión manual de flujos y permisos.

## 8. Instrucciones para retomar

1. Leer este archivo y el apartado inicial de S6 en `README.md`.
2. Confirmar que las migraciones 011 y 012 aparecen en el registro de desarrollo/pruebas; no recrear ni borrar volúmenes.
3. Repetir pruebas backend/frontend solo si cambia el código; última ejecución: 142 backend y 48 UI, todas pasaron.
4. Verificar `/api/v1/openapi.json` versión 4.5.0 y flujos financieros, recepción, auditoría y reporte imprimible con datos ficticios.
5. No declarar backup/restore ni rendimiento verificados hasta completar el ensayo aislado y las mediciones con dataset documentado.

## 9. Rediseño visual (28 de octubre de 2026)

Se renovó el frontend React/Vite con una identidad visual cálida y sobria, estilos globales responsivos y navegación lateral filtrada por rol. Se creó el botón reutilizable, se rediseñaron login y dashboard, y los estilos compartidos cubren los módulos existentes. Se mantuvieron rutas, permisos, campos y llamadas a API.

La documentación está en docs/REDISENO_UI_UX.md. La suite frontend pasó 48/48 pruebas; ESLint y build también pasaron. El build informa avisos de React Router sobre directivas use client ignoradas. No hubo navegador gráfico disponible para una revisión manual, por lo que quedan pendientes inspección visual por resolución y auditoría formal WCAG 2.2 AA.