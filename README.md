# Sistema de guardería infantil

Documentación única del proyecto. La especificación principal completa se conserva al final. Los accesos y contraseñas locales están exclusivamente en ACCESOS_LOCALES_PRIVADO.md y .env, ambos excluidos de Git.

## Inicio de S6: cuotas semanales y pagos parciales

Disponible solo para ADMIN en `/finanzas`, con acceso **Cuotas y pagos** desde Inicio. Este incremento cubre cuota manual, estado de cuenta, pago parcial/total y comprobante EJS imprimible. S6 continúa pendiente de prórrogas por API, avisos de mora, anulaciones/correcciones versionadas, exportaciones completas de auditoría/expediente, respaldo/restauración y verificaciones de rendimiento/entrega. La interfaz existente de baja de menores conserva expedientes e historial.

Decisiones identificadas antes de implementar: la especificación no define moneda, tarifa semanal ni día de corte. **El usuario confirmó pesos mexicanos (MXN)**; se muestra en pantalla, respuestas financieras y comprobantes nuevos. Tarifa y día de inicio permanecen pendientes. No se inventa una tarifa ni se generan cargos automáticos: ADMIN captura el importe y siete días consecutivos inclusivos, con vencimiento igual o posterior al inicio, sin solaparse con otra cuota vigente del menor. Se admiten periodos capturados históricos/futuros, pero la creación queda con hora real del servidor; no se fabrica una fecha pasada de emisión. Todos los importes de este módulo usan MXN, sin conversiones ni multimoneda. Solo se crean cuotas a menores ACTIVO; una baja posterior no borra deuda ni impide liquidar una cuota existente.

Los importes de API son **strings decimales** con punto, hasta dos decimales y máximo de almacenamiento 9999999999.99. Se rechazan números JSON, negativos, notación exponencial, comas y decimales excedentes. La cuota puede ser cero; un pago debe ser positivo y no superar el saldo. Los cálculos convierten a centavos enteros exactos dentro del rango seguro de JavaScript; no suman fracciones binarias. La cuota no se sobreescribe al pagar: saldo = importe menos pagos REGISTRADO, y los pagos ANULADO históricos no reducen deuda. LIQUIDADA/VENCIDA/PENDIENTE son estados derivados; la columna SQL de cuota conserva PENDIENTE/ANULADA. Vence cuando la fecha efectiva es anterior a hoy en la zona operativa; una prórroga histórica solo extiende, nunca acorta el vencimiento. El flujo para autorizar nuevas prórrogas todavía no se declara implementado.

Creación de cuotas/pagos exige confirmación, CSRF e Idempotency-Key de 8–64 caracteres, asociada al actor y contenido normalizado. Un reintento exacto recupera el registro original; importe equivalente 30 y 30.00 es la misma cantidad, mientras cambiar contenido con la misma clave devuelve 409. El bloqueo de cuota y bloqueo operativo compartido serializan solapamientos y cobros; dos pagos que sobrepasarían el saldo no pueden guardarse ambos. Cuota anulada rechaza pagos. El sistema no autoriza sobrepago, crédito excedente ni pagos sobre varias cuotas en una sola operación.

Métodos capturados: EFECTIVO/TRANSFERENCIA/TARJETA/OTRO, con referencia opcional de hasta 150 caracteres. Es un **registro manual** de pago recibido, sin pasarela, débito automático ni validación bancaria simulada. No se capturan números de tarjeta, CVV ni datos de acceso bancario. Fecha/actor provienen del servidor/sesión. No hay edición, borrado ni anulación por API en este incremento. Cuotas, pagos, consultas y comprobantes se auditan dentro de transacciones.

Cada pago conserva una instantánea del menor, periodo, cuota, importe pagado, acumulado, saldo después, método/referencia y responsable/hora UTC. Los pagos posteriores o cambios de nombre no reescriben ese comprobante. El documento muestra además el estado actual del registro de pago, sin ocultar una anulación histórica. El comprobante anterior sin instantánea devuelve 409; no se reconstruye. Es un registro interno imprimible/guardable como PDF desde el navegador, no una confirmación bancaria ni una integración fiscal.

La UI conserva formulario y clave ante fallo de red o sobrepago rechazado, actualiza saldos después del éxito y desmarca la confirmación. No permite repetir un guardado exitoso sin nueva interacción. Las respuestas de otra cuota seleccionada no sustituyen su ficha actual al cambiar de selección durante una consulta o pago.

API ADMIN bajo `/api/v1`: `GET /cuotas?id_menor=ID` (filtro opcional), `GET /cuotas/:id` (incluye historial de pagos), `POST /cuotas`, `POST /pagos`, `GET /pagos/:id`; comprobante `GET /reportes/pagos/:id`. OpenAPI acumulado **4.0.0**, contratos y errores documentados. Nuevos módulos `pagos.{validation,repository,service,routes}.js`, `Finanzas.jsx`, `views/ejs/pago.ejs` y pruebas S6.

Migración `database/migrations/010_finanzas.sql` aplicada en desarrollo/mysql-test sin borrar datos: añade clave/hash a cuotas/pagos y `pagos.comprobante JSON NULL`. Conserva 43 tablas, permisos, volúmenes y claves. El Dockerfile MySQL incluye su ejecución para nuevos volúmenes. Otras bases existentes requieren:

```powershell
docker compose cp database/migrations/010_finanzas.sql mysql:/tmp/010.sql
docker compose exec mysql mysql -uroot -p guarderia
```

En MySQL: `SOURCE /tmp/010.sql;`. No eliminar volúmenes. Las secciones siguientes conservan evidencia histórica; sus menciones de finanzas no iniciadas quedan sustituidas por este incremento, sin declarar S6 terminada.

## Continuación de S5: detección y reportes internos para autoridad

Disponible para ADMIN en `/autoridad`, desde **Salidas → Avisos → Revisar justificaciones → Reportes internos de autoridad**. Lista por fecha de asistencia, permite repetir manualmente la comprobación y abrir cada documento EJS para imprimir o guardar PDF desde el navegador. Solo ADMIN consulta, genera y abre documentos; no existe un quinto rol DIF ni un endpoint para marcar envíos.

Decisiones previas: se conserva el corte configurado de las **16:00 inclusive**, coherente con salida tardía y aviso previo; la alternativa 16:01 de la fuente no se aplica. La tarea revisa al iniciar el backend y cada 30 segundos, sin depender de navegador, y recupera asistencias de días anteriores que aún no tengan entrega. El horario de ejecución es aproximado: el documento conserva la hora real de detección, no inventa que se ejecutó exactamente a las 16:00. No se reconstruye una ausencia histórica ya entregada durante una interrupción; se evalúa la entrega tardía registrada y sus justificaciones. Se usa la zona y corte operativo vigentes para ausencias pendientes; las entregas usan su condición tardía congelada.

Reglas de generación:

- Sin entrega al corte: tipo NO_RECOGIDO, con motivo SIN_ENTREGA_AL_CORTE, aunque exista aviso pendiente. Es constancia factual de que no había entrega al detectar, sin afirmar abandono ni aprobación/rechazo de tolerancia. Como todavía no se conoce al receptor, no se le atribuye un contador ni se consume una tolerancia.
- Ya entregado tarde sin aviso: tipo OTRO, motivo ENTREGA_TARDIA_SIN_AVISO. Con aviso y justificación RECHAZADO: JUSTIFICACION_RECHAZADA. Con aviso aún pendiente pero receptor real con tres aprobaciones ese año: LIMITE_ANUAL_AGOTADO. Usar OTRO evita afirmar falsamente que un menor ya entregado sigue sin recoger.
- Entregado en horario o tardío con justificación aprobada: no genera reporte nuevo. Entregado tarde con aviso pendiente y contador disponible: espera revisión; no aprueba automáticamente ni trata pendiente como rechazo. Rechazar o agotar el contador se detecta en el siguiente ciclo.

La transacción comparte el bloqueo operativo de salidas/aprobaciones. Solo se genera un reporte de este control por asistencia; un NO_RECOGIDO existente no se duplica después de entregar, rechazar o reiniciar. Los reportes OTRO ajenos al control no bloquean por sí mismos su generación. Cambios posteriores de nombre, entrega o justificación no reescriben el hecho original. La instantánea incluye identificación mínima del menor, asistencia, corte/zona, ingreso, entrega/receptor si existe, aviso/motivo, estado de revisión y contador cuando se conoce. No incorpora expedientes, datos clínicos, credenciales ni archivos privados. No hay corrección/cancelación de reportes en esta API; una futura corrección deberá preservar versiones.

**Generar no es enviar:** se inserta exclusivamente GENERADO, sin `enviado_at`, referencia externa ni ruta de archivo ficticia. Un HTML imprimible no acredita envío ni recepción por el DIF. La entrega posterior se consulta en su bitácora; no se cancela ni se borra el reporte histórico. Responsable humano de la comprobación manual o actor NULL del proceso automático y evento GENERAR quedan auditados; las consultas/documentos también. La UI solicita confirmación para comprobar y no anuncia generación si falla la API.

Migración `database/migrations/009_reportes_autoridad.sql` aplicada sin borrar datos en desarrollo y mysql-test; añade `reportes_autoridad.contenido JSON NULL`, conserva 43 tablas, permisos y volúmenes. Los reportes anteriores sin instantánea se listan pero el documento devuelve 409 en lugar de reconstruir evidencia que no existe. Dockerfile MySQL incluye la migración para volúmenes nuevos. Para otras bases existentes:

```powershell
docker compose cp database/migrations/009_reportes_autoridad.sql mysql:/tmp/009.sql
docker compose exec mysql mysql -uroot -p guarderia
```

En MySQL: `SOURCE /tmp/009.sql;`. No eliminar volúmenes ni regenerar claves. Módulos `autoridad.{repository,service,routes,scheduler}.js`, `Autoridad.jsx` y `views/ejs/autoridad.ejs`. API ADMIN con sesión: `GET /api/v1/autoridad?fecha=YYYY-MM-DD`, `GET /api/v1/autoridad/:id`, `POST /api/v1/autoridad/generar` con `{confirmacion:true}` y CSRF, y documento `GET /reportes/autoridad/:id`. OpenAPI acumulado **3.8.0**. Sin fecha usa hoy; fechas inválidas/futuras y campos extra se rechazan. La tarea reintenta errores y espera el ciclo en curso al apagar.

Este incremento incorpora la generación/exportación interna de S5. Permanecen pendientes la revisión manual operativa de las pantallas/protocolos, la corrección versionada de registros y los puntos de política provisional ya documentados. No se declara integración oficial DIF ni certificación operativa completa. S6 continúa pendiente. Las secciones siguientes conservan evidencia de incrementos anteriores; sus menciones de reportes pendientes quedan sustituidas por este incremento.

Validación: **170 pruebas acumuladas aprobadas (128 backend y 42 UI)**. La suite completa backend aprobó 127; después se añadió y aprobó el caso de reporte anterior sin instantánea junto con las otras nueve pruebas de autoridad. Se verificaron corte 16:00, concurrencia/reinicio, ausencia con aviso pendiente, entrega en horario/aprobada, tardía sin aviso/rechazada, contador agotado, conservación tras entrega/cambio de nombre, recuperación de asistencias antiguas, permisos ADMIN/CSRF/fechas/payload, HTML escapado y error 409 de documentos anteriores. El planificador prueba recuperación de fallo y parada sin ciclos nuevos. La UI prueba confirmación, actualización, enlace privado imprimible y reintento sin generación ficticia. Build React y lint backend/frontend correctos. Migración 009 repetida en mysql-test sin duplicar ni borrar información. Fixtures ficticios exclusivamente en mysql-test; impresión/PDF y revisión operativa manual pendientes.

Despliegue verificado: MySQL/backend/frontend/phpMyAdmin saludables tras reconstruir con Docker Compose, conservando volúmenes. Smoke por proxy React aprobó login, listado de autoridad, revisión/avisos, módulos anteriores, OpenAPI 3.8.0 y logout, sin invocar generación manual ni transporte externo. El smoke comprueba además el documento EJS si existe reporte de hoy con instantánea; el render con datos ficticios ya se verificó en mysql-test. El backend inicia sin errores de sincronización en el registro revisado. Accesos privados y `.env` continúan ignorados por Git.

## Continuación de S5: aprobación de justificaciones por persona receptora

Implementada la decisión confirmada: **máximo tres justificaciones aprobadas por persona autorizada que efectivamente recoge y año de la asistencia**, acumuladas aunque recoja a distintos menores. Solo ADMIN consulta el historial anual y aprueba/rechaza en `/retardos/revisiones`, accesible desde **Salidas → Avisos de llegada tardía → Revisar justificaciones y contador anual**. RECEPCION conserva registro de avisos y entregas, sin permisos de revisión administrativa.

Antes de programar se fijaron estas reglas: el aviso no consume tolerancia; aprobar exige entrega real con condición tardía congelada por salida segura, receptor idéntico al registrado en la entrega, año coherente con asistencia, aviso posterior al ingreso y anterior a la entrega, y motivo comunicado. No se recalifica una entrega histórica cambiando el horario actual. Ausencia de entrega, recogida a tiempo o falta de aviso impiden aprobar. Rechazar conserva el antecedente y no consume tolerancia. No se exige que el vínculo siga activo al revisar una entrega histórica, pues la autorización efectiva se comprobó al entregar. El máximo confirmado es tres; el campo SQL histórico `max_tolerancias_anuales` no habilita superar ese límite mediante cambios directos a la base.

Las decisiones son definitivas por esta API. El mismo estado y motivo normalizado recuperan la decisión original; otra decisión o motivo devuelve 409. Corregir decisiones requerirá un flujo versionado posterior. Responsable, motivo, persona, año y hora real UTC quedan en auditoría tanto al aprobar como al rechazar; la aprobación además usa `aprobado_por/aprobado_at`. La UI muestra el contador de la persona, aviso, entrega y decisión conservada, solicita motivo y confirmación explícita y conserva el formulario si falla la red. Consulta el año actual por defecto y permite años desde 2000 no futuros.

Contar y aprobar ocurren dentro de la misma transacción con bloqueo operativo compartido: dos solicitudes que compiten por la tercera tolerancia no pueden producir una cuarta. No se alteran avisos/entregas ni se reinician contadores al cambiar de menor o de tutor. Cada año y persona tienen un contador independiente. No se crean tolerancias ni aprobaciones automáticas. Las consultas administrativas también quedan auditadas.

API con sesión ADMIN: `GET /api/v1/retardos/revisiones?anio=YYYY` y `PUT /api/v1/retardos/:id/decision` con `{estado: APROBADO|RECHAZADO, motivo, confirmacion:true}`, CSRF y payload estricto. OpenAPI acumulado **3.7.0**. Módulos: `retardos.repository.js`, servicio/rutas de retardos y `Revisiones.jsx`; sin migración nueva ni cambios en las 43 tablas o volúmenes. Las secciones siguientes conservan evidencia de incrementos anteriores; sus menciones de aprobación pendiente quedan sustituidas por este incremento. Tarea de detección y exportación DIF siguen pendientes de S5; S6 continúa pendiente.

Validación de aprobación: **158 pruebas acumuladas aprobadas (118 backend con MySQL real y 40 UI)**. Las seis pruebas nuevas de backend comprueban la tercera tolerancia concurrente entre menores del mismo receptor, reintentos sin doble consumo ni cambio de decisión/motivo, falta de aviso/entrega o entrega en horario, receptor/año incoherentes, aviso posterior, independencia entre años/personas, rechazo sin consumo y permisos/CSRF/payload estricto. La UI comprueba contador, confirmación, actualización tras guardar, reintento conservando contenido y rechazo de límite sin éxito ficticio. Build React y lint backend/frontend correctos. Las pruebas ficticias se ejecutaron solo en mysql-test; revisión manual de la pantalla pendiente.

Despliegue de este incremento verificado con Docker Compose: MySQL, backend, frontend y phpMyAdmin saludables. Smoke a través del proxy React aprobó login, historial de revisiones con criterio PERSONA_RECEPTORA, avisos, OpenAPI 3.7.0, consultas de módulos anteriores y logout. No se crearon aprobaciones ficticias en desarrollo ni se mostraron credenciales. El archivo de accesos y `.env` siguen ignorados por Git.

## Continuación de S5: avisos de llegada tardía

Disponible para ADMIN/RECEPCION en `/retardos`, con acceso desde **Salidas → Avisos de llegada tardía**. Registrar únicamente avisos realmente recibidos del responsable, indicando el motivo y confirmación manual. Consultar/registrar queda auditado. Los avisos no aprueban justificaciones ni consumen las tres tolerancias anuales.

Decisiones previas: se usa el fin exclusivo de salida configurado (actualmente 16:00), coherente con la salida tardía existente. A las 16:00 ya no se admite aviso previo; no se adopta silenciosamente la alternativa 16:01 de la fuente. El aviso exige asistencia de hoy ya ingresada y sin entrega. Actor y hora UTC son del servidor en la zona operativa configurada; el cliente no puede enviar fecha, aprobación ni persona. La identidad de quien comunica el aviso no se considera autorización de recogida; el receptor se vincula mediante la salida segura existente.

Decisión confirmada por el usuario: las tres justificaciones anuales se cuentan por persona autorizada que efectivamente recoge, identificada por `id_persona`, acumulando sus retardos aprobados en el mismo año aunque recoja a distintos menores. El aviso permanece PENDIENTE hasta revisión y no consume tolerancias por sí solo. La aprobación y automatización del contador o reportes DIF todavía no están implementadas. `retardos.id_persona` queda vacío hasta conocer al receptor real en la entrega. La salida conserva aviso/motivo y vincula ese receptor sin duplicar el retardo. Si se recoge dentro de horario, el aviso sigue como antecedente pendiente: no implica un retardo consumido y una futura aprobación deberá comprobar la hora efectiva de entrega.

API bajo `/api/v1`: `GET /retardos` devuelve asistencias, avisos y entregas del día con reloj y límite; `PUT /retardos/:id/aviso` recibe exclusivamente `{justificacion, confirmacion:true}` con sesión ADMIN/RECEPCION y CSRF. PUT es idempotente por asistencia: repetir el mismo texto normalizado recupera el primer aviso/hora, incluso después de entregar; cambiarlo devuelve 409. No hay edición, borrado ni aviso retroactivo. Las transacciones usan el bloqueo operativo compartido con salidas, evitando carreras entre aviso/entrega. Se reutilizan tablas existentes y sus permisos; no requiere migración ni reinicializar volúmenes. Contrato añadido al OpenAPI acumulado 3.6.0.

La interfaz conserva el formulario ante fallo de red, exige confirmación y muestra el aviso original después del éxito. Una entrega previa oculta el formulario y la API vuelve a verificarlo. No se agregan avisos ficticios en desarrollo; las pruebas de concurrencia, horario, permisos y entrega utilizan únicamente mysql-test. Aprobaciones, contador anual, tarea y exportación DIF siguen pendientes de S5; S6 también continúa pendiente.

Validación de este incremento: 150 pruebas acumuladas aprobadas (112 backend y 38 UI). La primera ejecución detectó un dato de prueba de salida con observaciones vacías; se corrigió el fixture y las cinco pruebas nuevas de avisos pasaron al repetirlas. El resto de la suite backend y toda la suite UI aprobaron. Build React y lint de ambos proyectos correctos. Docker Compose reconstruido con MySQL/backend/frontend/phpMyAdmin saludables; smoke verificó login, consultas de avisos, su contrato OpenAPI, módulos anteriores y logout por el proxy React. Los archivos privados siguen excluidos de Git. Revisión manual de la nueva pantalla pendiente.

## Continuación de S5: enfermería y recolección urgente

Disponible en **Enfermería y recolección**, `/enfermeria`. ADMIN/ENFERMERIA registran atenciones, incidentes, peso/talla y consultan cobertura. RECEPCION solo consulta solicitudes de recolección y confirma contactos realizados fuera del sistema. S5 sigue pendiente de avisos/aprobaciones de retardos, límite anual y reportes DIF; S6 no está implementada.

### Decisiones y reglas clínicas

- Se documentan motivo, acciones, responsable y hora real del servidor. No se generan diagnósticos, instrucciones de primeros auxilios ni recomendaciones clínicas automáticas. La atención pertenece a un menor existente y conserva historia sin edición/borrado por API. Se admite registro sin asistencia; si hay una asistencia abierta hoy se vincula automáticamente. Una asistencia indicada explícitamente debe ser actual, no entregada y del mismo menor. No se niega el registro de atención por una baja administrativa.
- Requiere_recoleccion crea una alerta PENDIENTE dentro de la misma transacción de atención; exige presencia actual y atención posterior al ingreso. Una clave repetida no crea otra atención ni otra alerta. No se permite solicitar urgencia para una asistencia ajena, antigua, ya entregada o inexistente. No se inventa un aviso por teléfono ni un contacto con tutor.
- ADMIN/ENFERMERIA/RECEPCION pueden confirmar manualmente un contacto, con detalle y actor/hora. La primera confirmación cambia a CONTACTADO, sin cerrar ni entregar; repetir no cambia el primer contacto. Se muestra información operativa de la solicitud, sin motivo ni acciones clínicas a RECEPCION. No hay envío automático de mensajes, llamadas, SMS o notificaciones push; actualizar solicitudes vuelve a consultar la base.
- Solo ADMIN/ENFERMERIA cancelan una solicitud, con motivo y confirmación. La alerta queda CERRADO y pierde la autorización horaria; no se borra ni se cambia la atención original. Una solicitud nueva requiere una nueva atención. El historial de atenciones/mediciones se consulta en la ficha; el listado de recolección muestra hasta 500 abiertas, incluidas anteriores para revisión. Los cierres/contactos conservan auditoría; no se implementó edición de contactos previos.
- Una salida anticipada exige seleccionar id_alerta_recoleccion abierta, vinculada a la atención/asistencia del mismo menor, creada después del ingreso y no futura. Solo exceptúa el inicio de la ventana ordinaria: conserva vínculo nominativo, identidad, restricción judicial, gafete complementario, confirmación y regreso de comedor. Una alerta ajena/cancelada no habilita la salida. Al entregar se cierran las alertas válidas de la asistencia, con motivo ENTREGA_REGISTRADA, hora y auditoría, dentro de la transacción de entrega. La atención y la referencia de la solicitud quedan en el resumen congelado. Sin solicitud urgente válida, antes de las 15:00 continúa rechazándose.
- Medición MENSUAL: una por menor ACTIVO y mes actual; fecha/primer día del periodo se calculan en la zona operativa del servidor. No se admite enviar fecha, periodo o actor. La clave de idempotencia recupera el registro original; una operación distinta que compite por el mes ya medido devuelve 409. Una medición por incidente no cubre la obligación mensual.
- Medición INCIDENTE: exige atención de hoy del mismo menor, no futura. Permite registros adicionales con nuevas claves, conservando cada evento. No se admite enlazar atención de otro menor ni usar una atención de un día anterior. La medición mensual no se enlaza a una atención.
- La fuente no fija rangos clínicos por edad/sexo. Se validan peso en kg positivo con hasta 3 decimales (máximo de almacenamiento 999.999) y talla en cm positiva con hasta 2 decimales (máximo 9999.99), más confirmación de identidad, medición real y unidades. Estos límites **no representan rangos clínicos normales**; no se inventa validación antropométrica ni se diagnostica. Corregir una medición registrada requiere un flujo versionado posterior, no sobreescritura.
- Cobertura: mes YYYY-MM válido no futuro, actual por defecto. La población de comparación es explícitamente ACTIVOS_ACTUALES, incluso al consultar otro mes: el esquema no permite reconstruir con precisión todos los cambios históricos de matrícula. Devuelve medidos, pendientes y detalle; completa solo si no hay pendientes. El reporte no inventa mediciones faltantes ni habilita registros retroactivos. Reconstrucción histórica de cohortes y corrección de periodos quedan pendientes.
- La UI conserva contenido/clave cuando falla la red. Después de guardar desmarca las confirmaciones y bloquea repetir sin nueva interacción; no fabrica éxito cuando la API rechaza. La cobertura se actualiza tras registrar una medición. La ficha usa control de solicitudes para no mostrar la respuesta de otro menor al cambiar de selección durante una operación.

### Migración 008 y API

`database/migrations/008_enfermeria.sql` aplicada en desarrollo/mysql-test y repetida en mysql-test sin borrar información. Añade clave/hash de idempotencia a atenciones y mediciones, y metadatos de contacto/cierre a alertas_recoleccion. Se conservan 43 tablas y los datos/archivos previos. El Dockerfile incorpora la migración en nuevos volúmenes; otras bases existentes requieren:

```powershell
docker compose cp database/migrations/008_enfermeria.sql mysql:/tmp/008.sql
docker compose exec mysql mysql -uroot -p guarderia
```

En MySQL: `SOURCE /tmp/008.sql;`. Conservar volúmenes y claves privadas. OpenAPI acumulado **3.6.0**, prefijo `/api/v1`; modificaciones con cookie, CSRF y payload estricto.

| Método | Ruta | Permisos / efecto |
|---|---|---|
| GET | /enfermeria/menores | ADMIN/ENFERMERIA; catálogo mínimo hasta 500 registros |
| GET | /enfermeria/menores/:id | ADMIN/ENFERMERIA; asistencia presente, últimas 100 atenciones y 100 mediciones; auditado |
| POST | /enfermeria/atenciones | ADMIN/ENFERMERIA; atención y alerta si procede; Idempotency-Key |
| POST | /enfermeria/mediciones | ADMIN/ENFERMERIA; mensual/incidente; Idempotency-Key |
| GET | /enfermeria/cobertura?mes=YYYY-MM | ADMIN/ENFERMERIA; activos actuales medidos/pendientes; auditado |
| GET | /enfermeria/recolecciones | ADMIN/ENFERMERIA/RECEPCION; solicitudes abiertas operativas, sin contenido clínico de atención |
| PATCH | /enfermeria/recolecciones/:id/contacto | ADMIN/ENFERMERIA/RECEPCION; confirmación de contacto realizado |
| PATCH | /enfermeria/recolecciones/:id/cierre | ADMIN/ENFERMERIA; cancelar solicitud con motivo |
| POST | /recepcion/salida | Extiende el contrato anterior con id_alerta_recoleccion opcional; urgencia válida permite anticipada y la entrega cierra solicitudes |

### Uso y evidencia

Seleccionar un menor en Enfermería, documentar motivo/acciones y confirmar la atención. Con presencia de hoy puede solicitarse recolección urgente. El personal contacta al responsable por el canal institucional y confirma el contacto. Recepción abre Salidas, selecciona la solicitud urgente, coteja al receptor y registra la entrega por el flujo existente. Para retirar la solicitud, ADMIN/ENFERMERIA justifican su cancelación; una solicitud cancelada no permite anticipada.

Para peso/talla, elegir mensual o incidente, cotejar unidades y confirmar. Mensual usa el periodo actual; incidente exige atención del mismo día/menor. Cobertura muestra pendientes de la población activa actual. La revisión de medidas y la atención física corresponden al personal autorizado; este sistema documenta lo registrado.

143 pruebas acumuladas aprobadas: 107 backend con MySQL real y 36 UI. Se verificaron atención/alerta atómicas e idempotentes, asistencia ajena/ausente/entregada, mensual concurrente/reintento, precisión/límites y periodo servidor, incidente de otro menor/día, cobertura pendiente, urgencia antes de horario con autorización nominativa, alerta ajena/cancelada, cierre por entrega, contacto sin entrega/cierre, permisos clínicos, CSRF y ausencia de hashes en historial. La UI prueba cotejos, reintento con la misma clave, actualización de cobertura, recepción sin ficha clínica y selección urgente además de vínculo/identidad. Build React y lint backend/frontend aprobados; revisión manual de esta pantalla pendiente.

Despliegue local verificado: MySQL, backend, frontend y phpMyAdmin saludables tras reconstruir con Docker Compose. La comprobación desde el proxy del frontend aprobó login, sesión, consultas de enfermería/recolecciones/cobertura y módulos anteriores, reporte EJS, OpenAPI 3.6.0 y logout, sin mostrar credenciales ni crear eventos clínicos ficticios.

Nuevos módulos: backend/src/modules/enfermeria (routes/controller/service/repository/validation), routes/openapi.enfermeria.js y frontend/src/modules/enfermeria/Enfermeria.jsx; pruebas s5.enfermeria.integration.test.js y nursing.test.jsx. Se mantuvieron las pruebas de entregas anteriores. No se registraron atenciones, mediciones, contactos ni entregas ficticias en desarrollo; fixtures solo en mysql-test. La especificación original al final continúa preservada y los accesos privados permanecen ignorados por Git.

## Incremento anterior de S5: salida segura

Disponible para ADMIN y RECEPCION en **Salidas**, `/salidas`. Este incremento implementa bitácora del día, entrega autorizada y resumen histórico. Enfermería y recolección urgente se incorporaron arriba. S5 conserva pendientes avisos/aprobaciones de retardos, límite anual y generación/reportes DIF; S6 tampoco se declara implementada.

### Decisiones previas y alcance de salida

- La fuente exige persona autorizada vigente del mismo menor, identidad, restricción judicial y confirmación. No define por completo el protocolo de gafetes compartidos. Decisión conservadora provisional: se exige vínculo nominativo vigente PRINCIPAL/AUXILIAR; un gafete es complementario y nunca autoriza por sí solo a una persona desconocida. Confirmar este protocolo con el responsable. No se implementó portador libre ni se interpreta un nombre escrito como prueba de autorización.
- Se comprueban persona activa, puede_recoger, inicio/fin del vínculo y menor correspondiente dentro de la misma transacción. Los intervalos conservan `[inicio,fin)`: un vínculo cuyo fin es hoy ya no autoriza. Una restricción judicial vigente del mismo menor/persona bloquea incluso si existe otro vínculo permisivo. Se exige cotejo manual de identidad y confirmación explícita de entrega; métodos DOCUMENTO físico o CHECK manual. No se recopila ni simula biometría ni se permite BIOMETRIA_EXTERNA.
- Ventana ordinaria provisional: `15:00:00 <= hora < 16:00:00`, desde configuracion_operativa. Antes del inicio se rechaza, también para ADMIN, salvo la solicitud urgente válida implementada arriba. Desde el fin se permite registrar la entrega autorizada como tardía: si no existía retardo, se crea PENDIENTE asociado al receptor y año. No se aprueban justificaciones ni se consumen tolerancias automáticamente. La atribución/aprobación del contador anual y el aviso previo pertenecen al siguiente flujo de S5.
- La asistencia debe ser del día actual y la entrega no puede preceder al ingreso. `hora_salida` del cliente es informativa y se ignora; actor, fecha/hora y condición tardía provienen de sesión/reloj servidor. No se habilita regularización retroactiva de entregas o recolección de asistencias de días anteriores en este incremento. Una baja administrativa posterior al ingreso no sustituye la autorización del receptor ni bloquea por sí sola la entrega.
- Se requiere que comedor no tenga un traslado abierto para la asistencia: primero se registra el regreso acompañado. La entrega hace que el menor deje de aparecer como presente en aula/comedor y las aplicaciones de medicamentos dejan de cumplir presencia mediante las consultas existentes, sin borrar la asistencia ni su historia.
- Un código de gafete opcional se coteja por SHA256 con el mismo menor y estado ACTIVO. Ajeno, REVOCADO o EXTRAVIADO se rechaza. Se normaliza el hexadecimal a minúsculas; su código no se guarda en claro en entrega, auditoría ni hash de solicitud intermedio. El nombre del portador se obtiene de la persona vinculada, sin confiar en texto del cliente. No se usa un ID de gafete enviado como prueba de posesión.
- Idempotency-Key obligatoria, asociada al actor/contenido normalizado. Un reintento conserva la entrega original; otros datos con la misma clave devuelven 409. La fila única por asistencia y el bloqueo operativo común impiden dos entregas concurrentes. El cliente conserva clave y formulario ante fallo de red. Una entrega registrada no se edita ni elimina por API.
- Los rechazos de negocio de una asistencia existente hacen COMMIT de RECHAZAR_SALIDA antes de responder 422, sin crear entrega. Payload inválido, clave ausente o asistencia inexistente conservan 400/404; no se crean registros con FK inválidas. No se auditan códigos de gafete en claro.
- Se congela la identidad del receptor y un resumen diario de actividades, alimentación, medicamentos y atenciones vinculadas a esa asistencia, más observaciones de entrega. Los cambios posteriores de nombre o registros diarios no reescriben lo entregado. La ficha muestra ese resumen congelado cuando ya hay entrega. No incluye rutas, hashes ni archivos privados. El resumen es una consulta de lo registrado, no una certificación de que todos los cuidados del día se hayan completado.

### Migración 007 y API de salida

`database/migrations/007_salida_segura.sql` aplicada en desarrollo/mysql-test y repetida en mysql-test sin borrar datos. Agrega entregas.resumen_diario/identidad_receptor y clave/hash de idempotencia; conserva las 43 tablas migradas. El Dockerfile MySQL incluye su ejecución al inicializar un volumen nuevo. Para otras bases existentes:

```powershell
docker compose cp database/migrations/007_salida_segura.sql mysql:/tmp/007.sql
docker compose exec mysql mysql -uroot -p guarderia
```

En MySQL: `SOURCE /tmp/007.sql;`. Conservar los volúmenes. El script SQL de referencia al final del documento permanece sin cambios.

OpenAPI acumulado **3.5.0**, prefijo `/api/v1`. Todas estas rutas son ADMIN/RECEPCION; cambios requieren CSRF.

| Método | Ruta | Resultado |
|---|---|---|
| GET | /recepcion/salidas | Bitácora de asistencias/entregas del día y ventana/reloj servidor; consulta auditada |
| GET | /recepcion/salidas/:id | Asistencia de hoy, autorizados y resumen; identidad/resumen congelados si ya fue entregado |
| POST | /recepcion/salida | Vínculo nominativo, gafete opcional, cotejo/confirmación, método y observaciones; Idempotency-Key; entrega o rechazo auditado |

Para revisar manualmente: entrar como ADMIN/RECEPCION, abrir Salidas y seleccionar una asistencia real de hoy. Cotejar la identidad física de la persona con la autorización seleccionada; comprobar el gafete si se presenta. Leer el resumen, confirmar identidad/entrega y registrar observaciones. Antes de las 15:00 se mostrará rechazo auditado; desde las 16:00 una entrega válida dejará retardo para revisión. Los tests contra mysql-test permiten probar bordes y concurrencia sin alterar el reloj ni crear entregas ficticias en desarrollo.

### Evidencia de salida

131 pruebas acumuladas aprobadas: 99 backend con MySQL real y 32 UI. Se verificaron 14:59/15:00/15:30/15:59:59/16:00/16:01, hora cliente ignorada, rechazo auditado sin entrega, vínculo ajeno/futuro/finalizado, persona inactiva, permiso de recoger, restricciones judiciales, gafetes ajenos/revocados/extraviados/válidos, entrega simultánea, reintento/conflicto de clave, identidad/resumen históricos, comedor abierto y desaparición del aula/comedor después de la entrega. La UI exige cotejos, conserva datos ante rechazo y clave ante fallo de red; no muestra éxito de una operación rechazada. Build React y lint backend/frontend aprobados. Revisión manual de la nueva pantalla pendiente.

Docker actualizado con `docker compose up -d --build --wait backend frontend phpmyadmin`; todos los servicios saludables. Se comprobaron login, bitácora de salidas, módulos anteriores, OpenAPI 3.5.0 y logout mediante el proxy del frontend, sin registrar entregas ficticias en desarrollo. Los accesos locales privados permanecen excluidos de Git.

Nuevos módulos: backend/src/modules/salidas con routes/controller/service/repository/validation, routes/openapi.s5.js y frontend/src/modules/salidas/Salidas.jsx; pruebas s5.salidas.integration.test.js y exits.test.jsx. No se agregaron menores, gafetes, asistencias, entregas ni retardos ficticios a desarrollo. Toda la documentación continúa en este README y los accesos privados siguen ignorados por Git.

## Incremento anterior de S4: comedor

Disponible en **Comedor**, `/comedor`, para ADMIN, EDUCADORA y ENFERMERIA. Se agregaron traslados acompañados, composición de platillos, revisión de restricciones, raciones y evidencia persistente. Los módulos principales de S4 están implementados; la revisión manual en tablet y la confirmación de las políticas académicas provisionales siguen pendientes. S5 comenzó con salida segura, descrita arriba; S6 sigue pendiente.

### Decisiones y reglas de comedor

- La fuente dice «mayores de un año» sin resolver el cumpleaños exacto. Decisión provisional: el traslado requiere fecha posterior al primer cumpleaños, calculado en calendario civil (incluido ajuste de 29/febrero); el día del cumpleaños todavía se bloquea. No se confunde con el cambio de área de inspección al cumplir un año.
- ADMIN y EDUCADORA registran traslados/raciones. EDUCADORA solo opera menores presentes de sus grupos activos con asignación vigente. ENFERMERIA/ADMIN mantienen catálogos y revisan restricciones; ENFERMERIA no realiza traslados/raciones. Recepción no accede. Se valida nuevamente asistencia de hoy, estado ACTIVO, grupo, ausencia de entrega y edad dentro de la transacción.
- Cada entrada/salida exige confirmar acompañamiento. Solo se permite un traslado abierto por asistencia. La salida usa reloj servidor y no puede preceder a la entrada; repetirla conserva la hora original. Se permiten otros traslados después de cerrar el anterior, con nueva clave. Un traslado omitido no se infiere automáticamente.
- El SQL original no tenía composición ni relación con restricciones. Se incorporaron ingredientes canónicos compartidos y versiones inmutables de platillos. El personal debe registrar todos los ingredientes reales, incluidos componentes de alimentos preparados, y usar los mismos IDs al revisar restricciones; el sistema no identifica ingredientes ocultos, sinónimos, contaminación cruzada ni composición a partir del nombre del platillo. El cotejo de receta/composición sigue siendo responsabilidad del personal.
- ADMIN/ENFERMERIA revisan cada restricción de forma explícita y vinculan ingredientes prohibidos. Este modelo solo cubre exclusión de ingredientes; una dieta que requiera otras condiciones (por ejemplo, textura o cantidades clínicas) debe conservar el bloqueo hasta contar con un modelo/revisión específica implementada. No se habilita consumo con una restricción vigente sin revisión estructurada. Se puede retirar una revisión con motivo y confirmación para restablecer el bloqueo; cambios/retiros conservan auditoría y no cambian evidencia histórica.
- Antes de registrar consumo se comprueba que ninguno de los ingredientes del platillo esté prohibido por las restricciones vigentes. Una dieta temporal además necesita receta vigente del mismo menor y documento médico revisado e íntegro. Una restricción cuya propia fecha final ya pasó no se aplica. Si la restricción todavía está activa pero su respaldo es inválido/vencido, se bloquea para revisión; no se ignora silenciosamente.
- Raciones: NADA/CUARTO/MEDIA/TRES_CUARTOS/COMPLETA. DESAYUNO/COMIDA/MERIENDA son los tipos provisionales de comida, uno por asistencia. Registrar consumo exige traslado abierto y confirmación de cotejo. NADA significa que no consumió alimento: requiere motivo e id_platillo=null; puede documentarse con una restricción pendiente porque no constituye autorización de un alimento. Las demás fracciones exigen platillo compatible.
- Cada ración conserva fecha/hora UTC, actor, observaciones y una copia de composición y restricciones/revisiones comprobadas. Los cambios clínicos posteriores no reescriben esa evidencia. No se editaron ni borraron raciones previas. La pantalla consulta presentes y registros de hoy; consulta histórica completa/corrección versionada siguen pendientes.
- Entrada y ración requieren Idempotency-Key por actor/contenido. Reintentos simultáneos con la misma clave conservan un solo registro; cambiar el contenido devuelve 409. Otra clave no permite duplicar una comida ya registrada ni abrir dos traslados. Todos los cambios se serializan con el bloqueo operativo compartido con grupos, recepción, medicamentos e inventario. No se confía en timestamps ni actores del cliente.

### Migración 006 y API

`database/migrations/006_comedor.sql` aplicada en desarrollo y mysql-test, sin borrar datos. Agrega ingredientes_comedor y platillos_comedor, revisión JSON de restricciones, idempotencia de traslados y composición/comprobación/idempotencia de raciones. **La base migrada tiene 43 tablas: 41 originales conservadas + 2 catálogos de comedor.** Se actualizaron healthcheck MySQL y prueba de esquema. El SQL de referencia y la especificación al final permanecen conservados. Los catálogos se insertan/consultan; la aplicación no ofrece edición ni borrado, y su inicialización no concede UPDATE sobre ellos.

Docker incorpora la migración para nuevos volúmenes. En otras bases existentes:

```powershell
docker compose cp database/migrations/006_comedor.sql mysql:/tmp/006.sql
docker compose exec mysql mysql -uroot -p guarderia
```

En MySQL: `SOURCE /tmp/006.sql;`. Luego reconstruir/recrear servicios con el Compose actualizado para que su healthcheck espere 43 tablas. Conservar los volúmenes; no usar `down -v` para migrar.

OpenAPI acumulado **3.4.0**. Prefijo `/api/v1`; modificaciones con sesión, CSRF y payload estricto.

| Método | Ruta | Alcance |
|---|---|---|
| GET | /comedor/catalogos | ADMIN/ENFERMERIA/EDUCADORA; ingredientes y últimas 500 versiones de platillos |
| GET | /comedor/presentes | ADMIN/ENFERMERIA: grupos activos; EDUCADORA: sus grupos; restricciones vigentes y registros de hoy; auditado |
| POST | /comedor/ingredientes, /comedor/platillos | ADMIN/ENFERMERIA; ingrediente canónico o composición revisada inmutable |
| POST | /comedor/restricciones/:id/revision | ADMIN/ENFERMERIA; exclusión de ingredientes y fundamento de cotejo |
| PATCH | /comedor/restricciones/:id/revision | ADMIN/ENFERMERIA; retirar revisión y restablecer bloqueo, con motivo |
| POST | /comedor/traslados | ADMIN/EDUCADORA; traslado acompañado e Idempotency-Key |
| PATCH | /comedor/traslados/:id/salida | ADMIN/EDUCADORA; cierre acompañado con hora servidor |
| POST | /comedor/registros | ADMIN/EDUCADORA; ración comprobada e Idempotency-Key |

### Uso y evidencia

1. ADMIN/ENFERMERIA agregan ingredientes y una versión del platillo con composición completa. Ante cambios de composición se registra otra versión.
2. Con asistencia del día, el menor aparece en Comedor. ADMIN/ENFERMERIA cotejan restricciones y respaldos y registran los ingredientes prohibidos. Una condición que no pueda representarse permanece bloqueada.
3. ADMIN/EDUCADORA confirman acompañamiento y registran entrada. Registran consumo real y observaciones; el servidor valida compatibilidad al guardar. Después registran la salida acompañada.
4. La ración muestra la composición histórica comprobada. Una revisión dietética puede cambiarse/retirarse sin modificar esas raciones anteriores.

115 pruebas acumuladas aprobadas: 86 backend con MySQL real y 29 UI. Comedor prueba edad antes/en/después del primer cumpleaños, acompañamiento, concurrencia/idempotencia, salida con reloj real, traslado requerido, alergia no revisada, ingrediente incompatible, evidencia inmutable tras cambiar revisión, retirada de revisión y restablecimiento del bloqueo, dieta temporal con documento inválido, dieta vencida, cinco raciones, tipos duplicados, permisos/grupos/presencia, ingredientes inválidos y campos de actor/hora no admitidos. UI prueba rechazo sin falso éxito, reintento con misma clave, NADA sin platillo, edad/rol y retirada confirmada. Build React y lint backend/frontend aprobados. No se crearon ingredientes, platillos, traslados ni raciones ficticias en desarrollo; fixtures exclusivamente en mysql-test.

Despliegue actualizado con `docker compose up -d --build --wait backend frontend phpmyadmin`: todos los servicios saludables con la base migrada de 43 tablas. Se comprobaron login, catálogos/presentes de comedor, medicamentos, actividades, módulos previos, OpenAPI 3.4.0 y logout por el proxy del frontend. Los logs del backend mostraron arranque normal; los accesos privados siguen ignorados por Git.

Revisión manual pendiente: composición real, cotejo clínico, flujo acompañado y uso en tablet (incluido audio de medicamentos). No se afirma certificación sanitaria ni validación automática de restricciones que el modelo no representa. La documentación sigue en este único README; accesos privados permanecen ignorados por Git.

## Incremento anterior de S4: medicamentos y alertas

Disponible en **Medicamentos y dosis**, `/medicamentos`, para ADMIN, ENFERMERIA y EDUCADORA. Este incremento agrega programación persistente, alertas visuales/sonoras, registro de dosis y suspensión de tratamientos. Comedor se incorporó en el incremento descrito arriba.

### Decisiones registradas para medicamentos

- Obligatorio: comprobar receta, tratamiento, horario, día, rol y estado pendiente; no permitir dos aplicaciones para una misma programación; conservar actor, hora y auditoría. La fuente deja la administración «según política» y no define margen clínico de retraso ni permisos detallados por vía.
- Política académica provisional: ADMIN/ENFERMERIA documentan todas las vías; EDUCADORA solo ORAL/TOPICA de menores de sus grupos activos con asignación actual. RECEPCION no accede. La vía OTRA exige ADMIN/ENFERMERIA, también para omitir. Confirmar esta matriz con el responsable antes de un uso operativo real; el código no interpreta una autorización clínica externa.
- Se registra una aplicación realizada tras cotejar identidad, prescripción y horario. Exige dosis exactamente igual a la prescrita, receta/documento revisados e íntegros, convivencia permitida, tratamiento vigente no suspendido, menor ACTIVO presente hoy sin entrega y dosificador graduado entregado cuando se requiere. No se admiten dosis parciales/distintas, tiempos ni actores desde el cliente. Los timestamps reales se guardan en UTC, con día/hora de decisión según configuracion_operativa.zona_horaria.
- No se permite registrar antes del horario, ni aplicar una programación de otro día. La fuente no fija tolerancia intradía; se conserva la hora real y se exige cotejo manual del horario. El sistema documenta el resultado y no recomienda aplicar una dosis tardía ni inventa una ventana clínica. Una política de tolerancias/autorizaciones clínicas más específica queda pendiente de confirmación.
- OMITIDA exige motivo, identidad/prescripción cotejadas y dosis_aplicada=null. Se puede documentar una pendiente ya vencida aunque el menor esté ausente, el tratamiento suspendido o el día haya terminado. No se transforma automáticamente una pendiente antigua en aplicada/omitida ni se usa la fecha actual como si fuera la programada.
- Cada resolución requiere Idempotency-Key. La misma clave, actor y contenido devuelve el resultado original sin repetir la aplicación; contenido diferente devuelve 409. Dos claves concurrentes compitiendo por una pendiente producen un registro y un 409. Una aplicación/omisión registrada no se edita ni elimina silenciosamente.
- ADMIN/ENFERMERIA pueden suspender permanentemente un tratamiento con confirmación, motivo y auditoría. Se conserva la prescripción original y las dosis históricas/pendientes; se bloquean aplicaciones y nuevas programaciones. Recepción deja de exigir dosificador para ese tratamiento suspendido. No se reactiva ni cambia la dosis original: una nueva prescripción revisada se registra por el flujo de recetas. No equivale a revocar la autorización de convivencia de la receta completa, que sigue evaluándose por sus propias fechas/reglas. Corregir un resultado ya registrado requiere un protocolo posterior que preserve versiones.
- Programaciones de distintas recetas/tratamientos permanecen independientes; la unicidad es horario/fecha. No se deducen equivalencias de fármacos ni se resuelven clínicamente prescripciones superpuestas por comparar nombres. El personal debe cotejar la prescripción y suspender explícitamente los tratamientos que corresponda.

### Persistencia, planificador y audio

Las dosis pendientes de tratamientos revisados/vigentes se crean en la misma transacción del ingreso aceptado y al registrar una receta para un menor presente. Así no se depende de que el navegador consulte ni de esperar el siguiente ciclo. Cada combinación horario/fecha tiene la restricción única original de MySQL. Las programaciones no implican que una dosis haya sido aplicada.

El proceso backend sincroniza al iniciar y cada 30 segundos, sin ciclos simultáneos dentro de un proceso; conserva auditoría de los lotes nuevos y reintenta tras errores. También sincroniza al consultar dosis. Reiniciar Express o cerrar el navegador conserva las pendientes en MySQL. Al apagar se detiene el ciclo antes de cerrar la conexión. El reloj inyectable solo existe como dependencia de pruebas; HTTP no permite cambiarlo. El ciclo programa el día actual; las pendientes antiguas ya guardadas siguen visibles para revisión.

La pantalla consulta cada 15 segundos y muestra aviso cuando llega el horario. **Activar sonido** requiere una acción del usuario, conforme a las [reglas de reproducción de Web Audio descritas por MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices#autoplay_policy). Emite un tono de prueba y, con pendientes cuyo horario llegó, repite como máximo una vez por minuto al actualizar datos. Se puede desactivar. El audio requiere navegador/pestaña disponibles, permiso y volumen; un navegador suspendido o cerrado no garantiza sonido. La persistencia de pendientes es del servidor, no del audio. No se implementaron push ni alarmas del sistema operativo. El audio se verificó mediante pruebas de su API; la audición real y el comportamiento de una tablet concreta quedan para revisión manual.

El listado muestra hasta 500 registros: dosis de hoy y pendientes anteriores, filtrados por grupo autorizado antes del límite para EDUCADORA. Los resultados anteriores a hoy se conservan en la base, pero la consulta histórica completa de resultados resueltos y su paginación quedan pendientes. La interfaz muestra indicaciones prescritas, horario, unidad/vía, presencia, bloqueos y resultado; no expone archivos, rutas, hashes ni diagnósticos a EDUCADORA.

### Migración 005 y API

`database/migrations/005_dosis_persistentes.sql` aplicada y repetida en desarrollo/mysql-test sin borrar información. Agrega tratamientos.suspendido y administraciones_medicamento.resuelta_at/clave_idempotencia/solicitud_hash. Conserva las 41 tablas originales. El Dockerfile MySQL incorpora su ejecución en volúmenes nuevos; en otras bases existentes se aplica explícitamente:

```powershell
docker compose cp database/migrations/005_dosis_persistentes.sql mysql:/tmp/005.sql
docker compose exec mysql mysql -uroot -p guarderia
```

En el cliente MySQL: `SOURCE /tmp/005.sql;`. No usar `down -v` para actualizar una base existente.

OpenAPI acumulado **3.3.0**, prefijo `/api/v1`. Las modificaciones requieren sesión, CSRF y payload estricto.

| Método | Ruta | Permisos y efecto |
|---|---|---|
| GET | /medicamentos/dosis | ADMIN/ENFERMERIA o EDUCADORA de sus grupos; sincroniza pendientes y devuelve estado/alertas; lectura auditada |
| POST | /medicamentos/dosis/:id/registro | ADMIN/ENFERMERIA, EDUCADORA ORAL/TOPICA de su grupo; Idempotency-Key, estado, dosis_aplicada, confirmaciones y observaciones |
| POST | /medicamentos/tratamientos/:id/suspension | ADMIN/ENFERMERIA; confirmacion=true y motivo; suspensión permanente auditada |

Para revisar manualmente: usar la receta revisada, dosificador y asistencia del día; abrir Medicamentos y dosis con el perfil correspondiente. Antes del horario no se permite resolver. Activar sonido y comprobar el tono en la tablet. Para registrar, cotejar identidad/prescripción/horario, documentar el resultado real y su motivo. El sistema vuelve a validar todo al guardar. No se agregaron medicamentos, menores, asistencias ni aplicaciones ficticias a desarrollo; las pruebas usan únicamente mysql-test y documentos cifrados en /tmp del contenedor de pruebas.

### Evidencia de medicamentos

98 pruebas acumuladas: 74 backend y 24 UI. Se verificaron programación sin navegador, creación transaccional al ingreso, ausencia de programación sin presencia, sincronización concurrente/reinicio, horarios, dosis exacta, permisos por grupo/vía oral/tópica/otra, dosificador, presencia del día, documento alterado, suspensión, omisión de pendientes antiguas, idempotencia, actor/reloj no falsificables, CSRF y recuperación/parada del planificador. UI: cotejos obligatorios, reintento de red, aplicación bloqueada, suspensión confirmada y audio sin reproducción antes de activarlo. Build React y lint backend/frontend aprobados; pruebas de audición y revisión visual/manual pendientes.

Docker actualizado con `docker compose up -d --build --wait backend frontend phpmyadmin`; los cuatro servicios quedaron saludables. Se verificaron login, GET medicamentos/dosis, actividades, módulos previos, OpenAPI 3.3.0 y logout mediante el proxy del frontend. El backend arrancó sin errores de sincronización en la comprobación de sus logs. No se registraron aplicaciones/omisiones ficticias en desarrollo y los accesos privados siguen ignorados por Git.

Al probar un archivo truncado se reforzó la lectura cifrada: longitud mínima del contenedor y etiqueta AES-GCM de 16 bytes explícita. No se cambió el formato de archivos, la clave ni el cifrado existente. Las pruebas de documentos/admisión y su integración siguen pasando.

Nuevos módulos: backend/src/modules/medicamentos/{routes,controller,service,repository,validation,planning,scheduler}, frontend/src/modules/medicamentos/{Medicamentos.jsx,sound.js}; pruebas s4.medicamentos.integration.test.js y medicines.test.jsx. Se conservan la arquitectura React/Express/MySQL, Docker y este único README.

## Incremento anterior de S4: actividades de aula

Disponible para ADMIN y EDUCADORA en **Actividades de aula**, `/aula/actividades`, desde el acceso superior. Este incremento agrega registro diario e historial por fecha. Medicamentos, alertas y comedor se describen arriba.

### Reglas y decisiones de actividades

- La especificación exige actividades y participaciones coherentes con grupo/fecha. Las FK originales no bastan: se validan dentro de una transacción, bloqueada junto con cambios de grupos/asignaciones e inventario.
- Diseño: el formulario registra una actividad realizada hoy, con título (3–160 caracteres), descripción opcional (hasta 2000) y entre 1 y 200 participantes distintos. Cada participante corresponde a una asistencia de hoy de un menor ACTIVO en ese grupo, aún sin entrega. Se admiten observaciones individuales de hasta 1000 caracteres. Una participación inválida cancela toda la operación; no deja actividad parcial.
- Diseño: fecha y responsable se obtienen del servidor y sesión. No se admiten esos campos desde el cliente. ADMIN puede supervisar/registrar, conservando su propio ID en la columna histórica `id_educadora`; no se atribuye la actividad a otra persona. RECEPCION y ENFERMERIA no tienen acceso.
- Diseño: las actividades realizadas no se editan ni borran silenciosamente. No se habilita planificación futura ni corrección retroactiva en este incremento. Esos flujos requerirían distinguir plan frente a ejecución y conservar versiones/motivos.
- Diseño: consulta histórica por fecha no futura; EDUCADORA debe tener asignación vigente tanto hoy como en la fecha consultada. Una asignación nueva no concede acceso a fechas anteriores a su inicio. ADMIN consulta grupos activos sin requisito de asignación. Los registros de grupos inactivos permanecen en la base; su consulta administrativa fuera de los grupos activos queda pendiente. La respuesta incluye las últimas 100 actividades de la fecha, con sus participantes históricos, sin filtrar esos participantes por su presencia actual. La pantalla de una fecha anterior es de consulta.
- Diseño: Idempotency-Key obligatoria (8–64 caracteres), por actor y contenido. Dos peticiones simultáneas o un reintento crean una sola actividad, un conjunto de participaciones y un evento de auditoría. Cambiar el contenido con la misma clave devuelve 409. La UI conserva clave/datos ante fallo de red; al cambiar datos genera otra clave. Una actividad distinta puede tener el mismo título con otra clave.

### Migración 004 y API de actividades

`database/migrations/004_actividades_aula.sql` aplicada en desarrollo y mysql-test. Agrega `clave_idempotencia` única y `solicitud_hash` a actividades_aula, sin borrar información y conservando las 41 tablas originales. Se comprobó su repetición en mysql-test sin duplicar la auditoría. El Dockerfile MySQL incorpora la migración para nuevos volúmenes; los existentes requieren aplicación explícita. No se recrearon ni vaciaron los volúmenes.

Desde `guarderia-web`, para aplicar en otra base existente:

```powershell
docker compose cp database/migrations/004_actividades_aula.sql mysql:/tmp/004.sql
docker compose exec mysql mysql -uroot -p guarderia
```

En MySQL: `SOURCE /tmp/004.sql;`. La contraseña se introduce en el prompt, no en la documentación.

OpenAPI acumulado versión **3.2.0**. Prefijo `/api/v1`:

| Método | Ruta | Resultado |
|---|---|---|
| GET | /aulas/grupos/:id/actividades?fecha=AAAA-MM-DD | Fecha operativa/consultada, presentes de hoy y últimas 100 actividades con participantes; lectura auditada. Fecha opcional, hoy por defecto. |
| POST | /aulas/grupos/:id/actividades | Actividad y participantes atómicos; sesión, CSRF e Idempotency-Key. Respuesta id_actividad, fecha, repetido. |

Para probar manualmente: entrar como ADMIN o EDUCADORA asignada, abrir Actividades de aula, seleccionar grupo y registrar título, descripción y participantes presentes. Sin un ingreso real aceptado hoy no se habilita el registro. La selección de otra fecha consulta el historial, sin registrar actividad retroactiva ni cambiar el reloj. No se añadieron menores, asistencias ni actividades ficticias a desarrollo.

### Evidencia de actividades

81 pruebas acumuladas aprobadas: 62 backend y 19 UI. La suite completa pasó con 61 backend; una prueba adicional de persistencia histórica y toda la suite S4 (11 pruebas) pasaron después. Se verificaron atomicidad ante participantes inválidos, fecha/grupo/presencia, duplicados en el payload, responsable/fecha no falsificables, permisos, consulta histórica restringida, dos creaciones concurrentes con una clave, conflicto de clave, un solo evento de auditoría y recreación de la aplicación al día siguiente. Las pruebas UI comprueban selección obligatoria de participantes, reintento de red con la misma clave y rechazo conservando datos sin anunciar éxito. Build React y lint backend/frontend aprobados; revisión manual de esta pantalla pendiente.

Despliegue local actualizado con `docker compose up -d --build --wait backend frontend phpmyadmin`; todos los servicios saludables. Se comprobaron login, consulta real de actividades, OpenAPI 3.2.0, endpoints previos y logout por el proxy del frontend, sin exponer credenciales ni crear actividades ficticias en desarrollo.

## Incremento anterior de S4: inventario de aula

S3 fue validada manualmente por el usuario. Este incremento de S4 implementa inventario individual de aula, consumo, ajuste y seguimiento de reposición. Actividades, medicamentos/planificador y comedor se incorporaron en los incrementos descritos arriba.

Accesos: ADMIN y EDUCADORA pueden abrir **Inventario de aula**, `/aula/insumos`, desde el acceso superior. ADMIN conserva `/insumos` para configurar requisitos, reponer, consumir, ajustar y consultar movimientos. RECEPCION repone y confirma contactos, sin ajustar ni consumir. ENFERMERIA no tiene permisos de inventario.

### Decisiones de este incremento

- Obligatorio: conservar el alias `PUT /aulas/insumos/descontar`, impedir saldos negativos y duplicación por reintento, mantener responsable e historial, avisar en 3/2/1 días y bloquear ingreso por falta del mínimo obligatorio.
- Diseño: EDUCADORA solo consume insumos de menores ACTIVO con asistencia de hoy, sin entrega registrada, en un grupo activo con asignación vigente. Se verifican asignación, pertenencia, presencia y saldo dentro de la misma transacción que registra el movimiento. Los intervalos conservan la regla `[inicio, fin)`. ADMIN puede consumir o ajustar desde inventario general; el alias de aula exige presencia también a ADMIN.
- Diseño: ENTRADA y CONSUMO reciben magnitudes positivas. AJUSTE recibe una diferencia con signo, nunca cero: `-2` resta dos, `2` suma dos; no representa el saldo final. Solo ADMIN ajusta, siempre con motivo. El rol EDUCADORA de la tabla orientativa de la especificación no concede ajustes administrativos.
- Diseño: días completos = piso(saldo / consumo diario estimado), calculado en milésimas. Una fracción menor de un día se muestra como 0 días completos, aunque quede saldo. El ingreso depende del mínimo obligatorio individual configurado, no de redondear la estimación. Sin tasa configurada se indica «Sin estimación»; saldo exactamente cero siempre genera aviso. No se supone un consumo diario para ropa, cobija u otros variables.
- Diseño: las alertas actuales se derivan de saldos persistidos y se reconstruyen al consultar, incluso después de reiniciar. El contacto con el tutor se realiza por el personal; registrarlo exige confirmación explícita y detalle. `avisos_insumo.notificado_por` identifica al usuario que confirma el contacto. No se atribuyen contactos humanos a tareas automáticas ni se envían correos/mensajes. Una consulta no crea un contacto. La combinación insumo/fecha/días impide contactos duplicados del mismo nivel en un día; si se repone y vuelve al mismo nivel ese día, se conserva el primer registro.
- Diseño: cada petición de movimiento requiere Idempotency-Key. Alias y endpoint principal comparten clave por actor y contenido; el reintento conserva el resultado original. Reutilizarla con otros datos devuelve 409. El cliente conserva la clave cuando falla la red y genera otra al cambiar los datos. Una asignación retirada impide incluso consultar/reintentar operaciones de aula.
- La política provisional de medicamentos, el planificador y la suspensión se describen al inicio de este README; la tolerancia clínica específica y la corrección versionada de resultados siguen pendientes de confirmación.
- La falta de composición del SQL original se resolvió con la migración 006 y la revisión de exclusión de ingredientes descrita arriba. Restricciones que no pueden representarse mediante este modelo permanecen bloqueadas para consumo.

### API y uso de inventario

Todos los cambios exigen sesión, CSRF y payload estricto. OpenAPI acumulado: `/api/v1/openapi.json`, versión 3.1.0. Prefijo de rutas: `/api/v1`.

| Método | Ruta | Alcance |
|---|---|---|
| GET | /aulas/grupos | ADMIN: activos; EDUCADORA: asignaciones vigentes |
| GET | /aulas/grupos/:id/insumos | ADMIN/EDUCADORA autorizada; menores presentes e inventario; lectura auditada |
| PUT | /aulas/insumos/descontar | ADMIN/EDUCADORA; solo CONSUMO de menor presente; Idempotency-Key |
| POST | /insumos/movimientos | ENTRADA ADMIN/RECEPCION; CONSUMO ADMIN/EDUCADORA de aula; AJUSTE ADMIN; Idempotency-Key |
| GET | /insumos/menor/:id | ADMIN/RECEPCION; saldos/estimaciones y últimos 100 movimientos/contactos |
| POST | /insumos/avisos | ADMIN/RECEPCION o EDUCADORA de aula; confirmación de contacto realizado |
| POST | /aulas/insumos/avisos | ADMIN/EDUCADORA; contacto por insumo de menor presente autorizado |

1. ADMIN configura requisitos y consumo estimado en Insumos; registra la reposición real.
2. Tras un ingreso aceptado durante la ventana habitual, la EDUCADORA abre Inventario de aula y selecciona su grupo. Sin asistencias reales no se muestran menores ni se habilita su consumo.
3. Registra cantidad y motivo de cada consumo. El servidor vuelve a comprobar los permisos, presencia y saldo. Actualizar saldos consulta la base; este incremento no tiene actualización automática ni alarma sonora.
4. Revisa los avisos y contacta al tutor por el canal institucional. Confirma el contacto con detalle para conservar la evidencia. Un aviso cuyo nivel cambió devuelve 409 y exige actualizar.
5. ADMIN puede corregir diferencias de inventario con AJUSTE y consultar los últimos movimientos. No hay edición ni borrado del historial.

No se agregaron tablas, migraciones, contraseñas ni datos ficticios en desarrollo. Se reutilizan las 41 tablas y la idempotencia de la migración 003. Los fixtures de pruebas solo se crean en mysql-test. La base de desarrollo conserva sus datos.

### Verificación de este incremento

58 pruebas backend y 17 UI aprobadas (75 acumuladas). Se probaron 3/2/1/0 días, precisión decimal, ausencia de tasa, rechazo de ingreso con stock obligatorio en cero, consumo concurrente, reintento compartido por alias, conflicto de clave, ajustes firmados y permisos, falta de clave, cantidades inválidas, desbordamiento, presencia, grupo ajeno, fin exclusivo de asignación, persistencia de avisos tras recrear la aplicación y contacto obsoleto. La UI prueba reintento de red, confirmación de contacto y rechazo sin mostrar éxito. Build React y lint backend/frontend aprobados. Revisión manual de las nuevas pantallas pendiente.

Desde `guarderia-web` se ejecutan las mismas comprobaciones documentadas para las entregas anteriores: `docker compose --profile test run --build --rm integration`, `docker compose run --rm --no-deps frontend npm test`, build y lint. Los módulos nuevos son `backend/src/modules/aulas`, `insumos.alerts.js`, `routes/openapi.s4.js`, `frontend/src/modules/aulas/AulaInsumos.jsx` y `insumos/StockOperations.jsx`; la documentación permanece en este README.

Imágenes backend/frontend reconstruidas y servicios comprobados con `docker compose up -d --wait backend frontend phpmyadmin`: todos saludables. El script de comprobación verificó login, grupos de aula, consultas de entregas previas, OpenAPI 3.1.0 y logout a través del proxy del frontend, sin mostrar credenciales ni crear menores/asistencias/movimientos de prueba en desarrollo.

## Estado de entregas: S1, S2 y S3 completas; S4 en desarrollo

Implementados y comprobados mediante pruebas automatizadas: login/logout/me; JWT de ocho horas en cookie HttpOnly; tabla de sesiones y revocación; CSRF; CORS con origen explícito; límite de login; cuatro roles; usuarios con alta/edición/baja lógica; grupos, capacidad y asignación de responsable; UI React con rutas protegidas y formularios; reporte EJS real de grupos; OpenAPI.

S1, S2 y S3: el usuario confirmó sus pruebas. Inventario, actividades, medicamentos/alertas y comedor de S4 implementados; revisión manual de S4 pendiente. S5 en desarrollo con salida segura implementada; S6 pendiente. HBS y las decisiones académicas provisionales siguen pendientes de confirmación del docente.

## Entrega 3: recepción, inspección y filtro médico

Nuevas secciones con el mismo acceso ADMIN: /recepcion, /recetas e /insumos en http://localhost:5173. RECEPCION opera la recepción y reposición; ENFERMERIA registra recetas/documentos médicos y alergias. ADMIN puede supervisar ambos flujos. EDUCADORA no recibe acceso anticipado a estos módulos.

### Flujo operativo

1. ADMIN revisa en Insumos los requisitos de cada menor. Configura mínimos obligatorios y saldos mediante reposición, o confirma expresamente que no necesita insumos. La ausencia de revisión bloquea el ingreso.
2. ENFERMERIA/ADMIN guarda la receta como documento médico privado, la descarga/revisa y transcribe médico, cédula, consulta, vigencia, convivencia explícita, dosis/unidades/vía/horarios e indicaciones. Tratamientos y dietas temporales deben estar dentro de la vigencia de la receta. La cédula y el documento se cotejan manualmente; no existe consulta oficial ni diagnóstico automático.
3. Recepción busca por código escrito/escaneado o por ID (modo explícito). La ficha muestra personas autorizadas para recoger, lesiones abiertas, restricciones vigentes, tratamientos, mínimos de insumos y los últimos 50 intentos. La lectura se audita.
4. Se registra inspección en CUNERO antes del primer cumpleaños y GENERAL desde ese cumpleaños. Se captura cada lesión nueva con ubicación, descripción y causa declarada (o constancia de que no fue declarada). Todas las lesiones abiertas requieren seguimiento del mismo menor, conservando la cadena histórica. Síntomas, lesión o pendiente relevante requieren nombre y parentesco de quien lo lleva; un entregante sano no necesita ser una persona autorizada para recoger.
5. El servidor vuelve a verificar edad, inscripción, documentos/Registro Civil, grupo/responsable, ventana, ausencia de asistencia duplicada, seguimiento, recetas/convivencia, dosificador y stock. El ingreso aceptado crea asistencia; el rechazado conserva intento, causa y auditoría sin asistencia. Reponer dentro de la ventana permite otro intento.

La ventana configurada inicial es 08:00:00 inclusivo a 09:00:00 exclusivo. En producción/desarrollo se usa reloj real del servidor y zona de configuracion_operativa; el reloj controlado solo se inyecta en pruebas y no es configurable desde HTTP o la interfaz. hora_ingreso del cliente se admite como informativa y no decide el ingreso. Fuera de horario se registra un rechazo, incluso si el operador tiene rol ADMIN; no hay bypass de demostración.

Para probar manualmente las reglas de entrada sin cambiar la configuración ni crear asistencias reales fuera de horario, ejecutar las pruebas automatizadas con reloj controlado contra mysql-test. Las fechas de intentos/inspecciones/asistencias se guardan en UTC; fecha operativa y hora de decisión se calculan en la zona de guardería.

### Reglas de salud y persistencia

- Síntomas requieren receta vigente, documento íntegro revisado y autorización explícita de convivencia. Un indicio de contagio incompatible o una receta vigente que prohíbe convivencia obliga a rechazar, aunque otra receta la permita. El sistema aplica una política conservadora, no determina diagnósticos.
- Todos los tratamientos se transcriben de una prescripción revisada; RECEPCION no puede crear recetas. Dosis positivas con hasta tres decimales y horarios únicos, dentro de fechas prescritas. No se acepta eludir un dosificador requerido por una dosis oral medible.
- Solo un dosificador GRADUADO entregado cumple; una cuchara/no graduado se rechaza. RECEPCION/ENFERMERIA/ADMIN registra su entrega o ausencia de forma auditada, sin modificar dosis. La disponibilidad física debe ser cotejada por el personal, y se mantiene el estado hasta registrar el cambio.
- Alergias basales se distinguen de dietas médicas temporales; las vencidas no se muestran como vigentes en recepción, pero siguen en el historial médico. Las vigencias médicas incluyen sus fechas inicial y final, a diferencia del cierre exclusivo de vínculos/grupos.
- Cada rechazo de negocio de un menor existente hace COMMIT antes de responder HTTP 422 con data.id_intento, resultado y motivos. No se hace rollback de la evidencia. Payload mal formado/identificadores inválidos tienen 400; un menor inexistente tiene 404 y no permite crear un intento con FK inválida.
- Las filas y el estado relevante se bloquean dentro de la transacción. Dos ingresos simultáneos producen una asistencia y un segundo intento rechazado. No se descuentan insumos al ingresar.
- Reposición ENTRADA usa Idempotency-Key obligatoria, persistida y asociada al actor y contenido. Reintentar la misma operación no aumenta dos veces el saldo; reutilizar la clave con otros datos devuelve 409. El cliente conserva la clave si falla la red. Los saldos usan aritmética en milésimas y límites del esquema.
- Prescripciones revisadas y documentos históricos no se sobreescriben por este módulo; se agrega nueva documentación. La corrección/revocación clínica de una prescripción vigente requiere un flujo posterior explícito: no se ofrece edición silenciosa del historial.

### Migración y archivos S3

003_recepcion_salud.sql aplicada en desarrollo y mysql-test. Agrega revisión individual de insumos, finalidad EXPEDIENTE/MEDICO de documentos, estado ABIERTA/RESUELTA de lesiones y clave/hash de idempotencia de movimientos. No elimina datos ni crea tablas nuevas: siguen las 41 tablas de referencia. La migración es repetible y registra su aplicación una sola vez en auditoría. Las bases existentes requieren ejecución explícita; nuevos volúmenes la ejecutan al inicializar.

Desde guarderia-web:

```powershell
docker compose cp database/migrations/003_recepcion_salud.sql mysql:/tmp/003_recepcion_salud.sql
docker compose exec mysql mysql -uroot -p guarderia
```

Dentro de MySQL:

```sql
SOURCE /tmp/003_recepcion_salud.sql;
```

Los archivos médicos reutilizan cifrado/volumen privado de S2. ENFERMERIA solo descarga documentos de finalidad MEDICO del mismo menor, no actas, identificaciones ni respaldos judiciales. Un documento médico no sirve como respaldo judicial de autorizados. Los JSON no devuelven rutas o hashes privados.

### API de S3

OpenAPI completo versión 3.0.0 en /api/v1/openapi.json. Todos los cambios requieren cookie y CSRF.

| Método | Ruta con prefijo /api/v1 | Permisos |
|---|---|---|
| GET | /recepcion/menor/:codigo?tipo=CODIGO o ID | ADMIN/RECEPCION |
| POST | /recepcion/ingreso | ADMIN/RECEPCION |
| GET | /recetas/menores, /recetas/menor/:id | ADMIN/ENFERMERIA |
| POST | /recetas | ADMIN/ENFERMERIA |
| POST | /recetas/documentos/:id | ADMIN/ENFERMERIA; cuerpo binario PDF/PNG/JPEG, 2 MB |
| GET | /recetas/documentos/:id/:documentId | ADMIN/ENFERMERIA; solo finalidad MEDICO |
| PATCH | /recetas/tratamientos/:id/dosificador | ADMIN/RECEPCION/ENFERMERIA |
| POST | /recetas/restricciones-base | ADMIN/ENFERMERIA |
| GET | /insumos/tipos, /insumos/menor/:id | ADMIN/RECEPCION |
| PUT | /insumos/menor/:id/requerimientos | ADMIN |
| POST | /insumos/movimientos | ADMIN/RECEPCION; solo ENTRADA en S3 e Idempotency-Key |

### Evidencia acumulada y límites de entrega

64 pruebas aprobadas: 51 backend con MySQL real aislado y 13 UI. Se conservaron las pruebas S1/S2 y se añadieron reloj UTC/local, 07:59/08:00/08:15/09:00/09:01, edad 29/30 días/cuarto cumpleaños, rechazo con evidencia sin asistencia, concurrencia, seguimiento de lesiones, receta/convivencia, dosis/horarios/rangos, dosificador graduado, dieta vencida, alergia basal, falta/reposición de insumos y reintento idempotente. Las pruebas de interfaz verifican rechazo persistido, acompañante condicional, documento/revisión clínica explícita y conservación de clave ante fallo de red.

Build de React y lint backend/frontend aprobados; se reforzó no-undef tras detectar y corregir en pruebas un error al construir la lista de lesiones. La revisión visual/manual de S3 en tablet queda pendiente del usuario. No se prometen p95, cobertura porcentual o disponibilidad sin medirlos.

Nuevos módulos backend recepcion, recetas e insumos con routes/controller/service/repository/validation, utils/clock.js y routes/openapi.s3.js. Nuevos módulos frontend Recepcion.jsx, Recetas.jsx e Insumos.jsx y pruebas s3.integration.test.js/reception.test.jsx. La documentación permanece en este único README.

Continuación de S4: comedor, medicamentos/alertas, actividades, consumo/ajuste, alias de aula y avisos de inventario se describen arriba. S5 incorporó salida segura, enfermería y recolección urgente; conserva pendientes retardos/aprobaciones y DIF. S6: finanzas, auditoría completa y restauración de respaldos.

## S3: decisiones registradas antes de implementar

S2 revisada por el usuario. Se inicia recepción y filtro médico; las decisiones siguientes son de implementación académica y no una certificación sanitaria.

- Ingreso con inicio inclusivo y fin exclusivo: 08:00:00 <= hora < 09:00:00, usando configuracion_operativa y reloj del servidor en su zona. El reloj inyectable es exclusivamente una dependencia de pruebas; no se expone por HTTP ni por un control de interfaz. Los timestamps de ingreso recibidos del cliente son informativos y no deciden la admisión.
- ADMIN supervisa recepción además del rol RECEPCION. Recetas/revisión médica solo ADMIN o ENFERMERIA. Documentos médicos quedan separados del expediente general por finalidad y solo esos roles los descargan. No se verifica cédula ni receta con una autoridad externa.
- Receta revisada, documento privado y autorización explícita de convivencia para aceptar síntomas; un indicio de contagio incompatible obliga a rechazar. Dosis medibles exigen dosificador graduado, nunca cuchara convencional. La recepción registra entrega del dosificador sin editar la prescripción.
- Antes del primer ingreso, ADMIN revisa requisitos individuales de insumos. Sin revisión se rechaza. Declarar que no requiere insumos exige una confirmación explícita y auditada; no se imponen pañales/leche a todos los menores por defecto. S3 agrega reposición ENTRADA para permitir reintento; consumo/ajuste, avisos 3/2/1 y planificación persistente de dosis son S4.
- Cada lesión abierta de la última inspección requiere seguimiento del mismo menor. Una nueva observación enlaza la lesión previa, con estado ABIERTA o RESUELTA; las observaciones anteriores se conservan. Rechazos de negocio se confirman en la base antes de devolver el error y no crean asistencia. Payloads mal formados se rechazan como validación HTTP.

## Entrega 2: expedientes y admisión

Acceso ADMIN en http://localhost:5173 con las mismas credenciales privadas. Nuevas secciones: **Expedientes** (/expedientes) y **Preinscripciones** (/preinscripciones). RECEPCION puede consultar expedientes y vínculos por API, con vista básica de la ficha; no puede subir/descargar documentos ni modificar expedientes. EDUCADORA y ENFERMERIA no acceden a estos módulos.

Flujo del asistente de expedientes:

1. Registrar datos y preinscripción de origen opcional: siempre queda PENDIENTE. Se admite capturar un expediente fuera de edad de recepción, pero nunca activarlo.
2. Subir acta, CURP y otros respaldos. Descargar y revisar cada documento antes de confirmar su validación.
3. Crear/reutilizar personas, vincular principales/auxiliares, registrar identificaciones privadas y emitir gafetes. Se conserva la historia de vínculos finalizados.
4. Confirmar manualmente Registro Civil, elegir grupo compatible con edad y activar. Esta revisión no es una consulta electrónica a una autoridad.

La activación exige 30 días cumplidos y fecha anterior al cuarto cumpleaños, CURP registrada, acta/CURP validadas, revisión manual de Registro Civil y grupo activo con responsable EDUCADORA vigente y cupo. Se recalcula la categoría por cumpleaños; cambiar grupo es explícito y auditado, no un traslado automático. La recepción diaria, horarios y rechazo de ingreso corresponden a S3; no se presenta aún un endpoint de recepción implementado.

Cambios de identidad requieren expediente no activo e invalidan su revisión civil. Baja/expulsión conserva documentos e historial. Reabrir como pendiente requiere motivo y no activa automáticamente. No se puede desactivar/cambiar categoría de un grupo con expedientes activos sin reubicarlos o pasarlos a pendiente.

### Decisiones provisionales de S2

- Preinscripción: entre la fecha civil actual y cuatro meses calendario posteriores para la fecha probable de parto, ambos extremos incluidos. El parámetro preinscripcion_meses reside en configuracion_operativa. Confirmar esta interpretación con el docente. Confirmar una solicitud no crea ni activa un menor.
- Principales: máximo 3 provisional; auxiliares: máximo 3; gafetes: hasta 3 números por menor. Se parametrizan mediante max_principales, max_auxiliares y max_gafetes. Los cambios administrativos de parámetros deben conservar auditoría; no hay pantalla de configuración de políticas todavía.
- Vínculos e historial de grupos usan [fecha_inicio, fecha_fin), con fecha_fin NULL abierta. Se permite programar el fin del vínculo en una fecha posterior a hoy o finalizarlo explícitamente; el límite cuenta todos los vínculos vigentes aunque tengan un vencimiento futuro. La edad usa fechas civiles de America/Mexico_City; al sumar meses a un día inexistente se usa el último día del mes (incluido 29/febrero). Esta es una decisión de calendario, no una conclusión jurídica.
- La CURP se valida por formato y unicidad y se muestra enmascarada en JSON; no se afirma validación oficial de RENAPO. El cotejo con los documentos es responsabilidad del ADMIN que confirma la revisión.
- Una persona puede tener vínculos con varios menores. Una restricción judicial impide marcar puede_recoger y exige un respaldo OTRO validado del mismo menor. Se rechazan vínculos duplicados vigentes; el límite se comprueba dentro de la transacción aun con concurrencia.
- Los códigos de gafete se devuelven una sola vez al emitir; solo se guarda SHA256, no el código. La consulta no devuelve código ni hash. Se pueden revocar/marcar extraviados, sin liberar números históricos. Reposición/rotación de los tres números y protocolo de portador compartido quedan pendientes de definición; S2 no implementa entrega de menores por gafete.
- La identificación privada de persona conserva su primer archivo; el reemplazo/versionado requiere un flujo posterior explícito. Los documentos de menor se agregan, no se sobreescriben ni eliminan.

### Archivos privados y migración 002

Volumen Docker private_uploads, fuera de cualquier ruta estática. Cifrado AES-256-GCM con DOCUMENT_ENCRYPTION_KEY (64 caracteres hexadecimales) en .env; identificadores aleatorios de archivo, permisos privados, SHA256 de documentos y verificación de integridad al leer. No cambiar/perder la clave sin migrar los archivos; debe incluirse en el respaldo privado junto con el volumen. Rotación y recuperación completa se ensayarán en S6.

Se aceptan PDF/PNG/JPEG de hasta 2 MB con firma/cierre coincidentes con el MIME declarado; se rechazan tipos falsos, archivos vacíos y marcadores conocidos de contenido activo PDF. Esto no es un antivirus ni una validación oficial del contenido. Las descargas son adjuntos autenticados ADMIN, auditadas y sin exponer rutas privadas o hashes en JSON. La documentación de OpenAPI describe el envío binario con X-Document-Type, no multipart.

Migración 002 aplicada en desarrollo y pruebas sin borrar datos: agrega max_principales=3, max_gafetes=3 y preinscripcion_meses=4 a configuracion_operativa, conservando las 41 tablas originales y registrando la aplicación en auditoría. Admite repetición sin duplicar columnas o el registro. Nuevos volúmenes la aplican automáticamente después de la migración 001; en bases existentes ejecutar explícitamente como administración:

```powershell
docker compose cp database/migrations/002_politicas_admision.sql mysql:/tmp/002_politicas_admision.sql
docker compose exec mysql mysql -uroot -p guarderia
```

Dentro del cliente MySQL:

```sql
SOURCE /tmp/002_politicas_admision.sql;
```

### API agregada en S2

Prefijo /api/v1. Todos los cambios exigen CSRF y ADMIN. Esquemas completos en /api/v1/openapi.json (versión 2.0.0).

| Método | Ruta | Resultado / acceso de lectura |
|---|---|---|
| GET / POST | /admin/menores | Listado ADMIN/RECEPCION; creación pendiente ADMIN |
| GET / PATCH | /admin/menores/:id | Ficha e historial ADMIN/RECEPCION; edición ADMIN |
| POST | /admin/menores/:id/registro-civil | Revisión manual explícita |
| POST | /admin/menores/:id/activar | Activación o cambio de grupo transaccional |
| POST | /admin/menores/:id/estado | Pendiente/baja/expulsión con motivo |
| POST | /admin/menores/:id/documentos | Archivo binario privado, ADMIN |
| GET / PATCH | /admin/menores/:id/documentos/:documentId | Descarga/revisión, ADMIN |
| GET / POST / PATCH | /preinscripciones, /preinscripciones/:id | Solicitudes y estados, ADMIN |
| GET / POST / PATCH | /personas, /personas/:id | Personas reutilizables; lectura ADMIN/RECEPCION |
| GET / POST | /personas/:id/identificacion | Identificación privada, ADMIN |
| GET / POST / PATCH | /menores/:id/autorizados, /menores/:id/autorizados/:linkId | Vínculos; lectura ADMIN/RECEPCION |
| POST / PATCH | /menores/:id/gafetes, /menores/:id/gafetes/:badgeId | Emisión y revocación, ADMIN |

Los listados iniciales se limitan a 500 registros; paginación y búsqueda de conjuntos mayores quedan pendientes. No se incorporaron datos ficticios de menores a la base de desarrollo; los fixtures se ejecutan exclusivamente contra mysql-test.

### Evidencia acumulada de S1 y S2

44 pruebas aprobadas: 35 backend (incluida integración con MySQL real) y 9 UI. Se probaron edad 29/30 días/cuarto cumpleaños, fechas inválidas, preinscripción fuera de ventana, activación incompleta, categoría y cupo, dos peticiones concurrentes que compiten por el último cupo, auxiliar número cuatro concurrente, vínculo reutilizable, documentos de otro menor, 403 de lectura privada, cifrado/descifrado, MIME falso, exceso de tamaño, archivo alterado, hashes/códigos no expuestos, revocación de gafetes y conservación histórica. Se mantuvieron aprobadas las pruebas S1. Build React y lint de ambos proyectos aprobados. Revisión visual/manual en tablet pendiente.

Los servicios se recrearon con la configuración actual. Se verificaron login y consultas S2 a través del proxy frontend, y escritura/lectura cifrada del volumen privado sin crear expedientes de prueba en desarrollo. La clave no se imprimió ni se incorporó a Git.

Nuevos módulos backend: menores, preinscripciones, tutores y documentos, con sus capas routes/controller/service/repository/validation cuando aplica; storage.js concentra cifrado y manejo de archivos. Nuevos módulos frontend: menores/{Expedientes,Documents,Autorizados}.jsx y preinscripciones/Preinscripciones.jsx. Se agregaron s2.integration.test.js y admission.test.jsx; sigue habiendo una sola documentación README.

Docker ya se pudo ejecutar fuera del entorno aislado. Se reprodujo y corrigió el backend unhealthy por resolución DNS recreando servicios con Compose. Se confirmó login y lectura de usuarios/grupos/reporte/OpenAPI a través del proxy React → Express → MySQL. Los servicios de desarrollo quedaron levantados.

## Entrar y ejecutar

- Frontend: http://localhost:5173
- API: http://localhost:3000/api/v1
- Estado: http://localhost:3000/api/v1/health
- OpenAPI JSON: http://localhost:3000/api/v1/openapi.json
- Reporte HTML EJS (ADMIN): http://localhost:5173/reportes/grupos
- phpMyAdmin: http://localhost:8081 (PHPMYADMIN_PORT configurable)
- MySQL dentro de Docker: mysql:3306, base guarderia; sin puerto MySQL publicado en Windows.

Ya se creó un ADMIN local con contraseña aleatoria: consultar ACCESOS_LOCALES_PRIVADO.md. No se utilizan usuarios o contraseñas web predeterminadas. Las credenciales MySQL son independientes del login web.

Requiere Docker Desktop, contenedores Linux y Compose v2. Desde la raíz:

```powershell
cd guarderia-web
docker compose up -d --build --wait backend frontend phpmyadmin
```

Para una instalación nueva: copiar .env.example a .env (sin sobrescribir uno existente); configurar las cuatro contraseñas de MySQL, JWT_SECRET aleatorio de al menos 32 caracteres y DOCUMENT_ENCRYPTION_KEY de 64 caracteres hexadecimales. Las contraseñas APP deben contener 32–128 caracteres alfanuméricos, guion o guion bajo. JWT_SECRET no se expone al frontend. Nunca versionar .env.

Las imágenes Node 24 utilizan npm ci y package-lock.json versionados. Los Dockerfile son de desarrollo, con dependencias de pruebas; no constituyen imágenes de producción. Los cambios de src se recargan automáticamente; reconstruir por cambios de dependencias. Vite permite el hostname interno frontend para las comprobaciones entre contenedores y redirige /api y /reportes a backend:3000.

## Estructura modular

```text
README.md
guarderia-web/
  compose.yaml
  .env.example
  backend/
    Dockerfile, package.json, package-lock.json, eslint.config.js
    src/
      config/{database.js,env.js}
      middlewares/security.js
      modules/{auth,usuarios,grupos,menores,preinscripciones,tutores,documentos}/
        *.routes.js, *.controller.js, *.service.js
        *.repository.js, *.validation.js
      routes/{openapi.js,openapi.s2.js}
      utils/{http.js,transaction.js}
      app.js, server.js
    scripts/{create-admin.js,smoke.js}
    tests/{health.test.js,s1.integration.test.js,s2.integration.test.js}
    views/ejs/grupos.ejs
  frontend/
    Dockerfile, package.json, package-lock.json
    vite.config.js, vitest.config.js, eslint.config.js, index.html
    src/
      api/client.js
      context/AuthContext.jsx
      routes/{AppRouter.jsx,ProtectedRoute.jsx}
      modules/administracion/Management.jsx
      tests/{auth.test.jsx,admission.test.jsx}
      App.jsx, main.jsx, app.css
  docker/mysql/{Dockerfile,20-app-user.sh}
  database/
    schema_completo_v2.sql
    migrations/{001_grupos_inactivos.sql,002_politicas_admision.sql}
```

Los controllers manejan HTTP; servicios aplican reglas/transacciones y repositorios contienen SQL parametrizado. No hay carpetas de módulos futuros vacías ni pantallas que simulen su implementación.

## Seguridad y reglas S1

- ADMIN gestiona usuarios, grupos y reporte; RECEPCION/EDUCADORA/ENFERMERIA acceden solo a su sesión y bienvenida en S1. No se crea un rol DIF.
- JWT HS256 con issuer/audience, expiración fija 8h, cookie HttpOnly y SameSite=Lax. Secure obligatorio en producción (HTTPS); localhost de desarrollo usa COOKIE_SECURE=false. Nunca se guarda JWT en localStorage ni se devuelve en JSON.
- Cada petición autenticada consulta sesión, actividad y rol actuales. Modificar usuario revoca todas sus sesiones. Logout revoca la sesión y borra la cookie.
- POST/PATCH autenticados exigen X-CSRF-Token derivado de la sesión; se obtiene en login/me. Login requiere origen permitido si se envía Origin y limita diez intentos por quince minutos/IP. Configuración local de una instancia; despliegue distribuido requerirá almacén compartido del limitador.
- Payloads Zod estrictos; contraseña nueva 12–72 caracteres y máximo 72 bytes UTF-8, bcrypt coste 12. Los cambios y login/logout se auditan sin hashes, tokens o contraseñas.
- Baja lógica, sin DELETE. No se puede retirar al último ADMIN activo ni dar baja/cambiar de rol a una responsable vigente. Las validaciones concurrentes usan transacciones y bloqueo de configuracion_operativa id=1.
- Grupos nuevos inactivos por defecto. Activación exige responsable EDUCADORA activa. Código único, categoría existente y capacidad positiva/no inferior a ocupación. Una responsable vigente por grupo mediante bloqueo. Cambios conservan historial.
- DECISIÓN DE DISEÑO S1: intervalos de asignación [fecha_inicio, fecha_fin); fecha_fin NULL significa abierta. Permite sustitución el mismo día sin solapar vigencia. No se exige exclusividad de una educadora entre diferentes grupos, porque el maestro no la establece. Mayor precisión horaria requeriría migración futura.
- EJS escapa datos; reporte solo ADMIN. Cookie y no-store protegen la sesión. Archivos sensibles permanecen privados.

## SQL y migraciones

Se conservó íntegro el esquema v2 de 41 tablas. Se ejecutó en un servidor MySQL separado de pruebas y se verificaron CHECK, catálogos, persistencia y privilegios. El usuario también corroboró las tablas de desarrollo.

Migración 001: DEFAULT FALSE de grupos, sin cambiar grupos existentes ni borrar datos. Registra su aplicación en auditoria_eventos y permite repetición sin duplicar el registro. Aplicada al servidor de desarrollo. La imagen de nuevas bases la aplica tras el esquema. Bases preexistentes requieren ejecución administrativa explícita; la inicialización de Docker solo ocurre en volúmenes vacíos.

Para aplicar en otra instancia existente desde guarderia-web:

```powershell
docker compose cp database/migrations/001_grupos_inactivos.sql mysql:/tmp/001_grupos_inactivos.sql
docker compose exec mysql mysql -uroot -p guarderia
```

Dentro del cliente MySQL:

```sql
SOURCE /tmp/001_grupos_inactivos.sql;
```

No se desactivan automáticamente grupos antiguos sin responsable: revisar inconsistencias antes de usarlos. No borrar volúmenes para cambiar contraseñas o migrar; cambiar .env no modifica usuarios SQL existentes. Aplicación sin DELETE/DDL y sin UPDATE sobre auditoría; root reservado a administración. Revisiones de integridad cruzada de expedientes/salud/salidas se desarrollan en sus entregas.

## Crear un ADMIN en una instalación nueva

Ya hay uno creado en este entorno. En una instalación sin ADMIN, recibir la contraseña en el entorno del comando, no en argumentos ni código:

```powershell
$credential = Read-Host 'Contraseña inicial (mínimo 12 caracteres)' -AsSecureString
$env:ADMIN_PASSWORD = [Net.NetworkCredential]::new('', $credential).Password
docker compose run --rm --no-deps -e ADMIN_PASSWORD backend npm run admin:create
Remove-Item Env:ADMIN_PASSWORD
```

El script solicita nombre y correo y rechaza crear otro ADMIN inicial si ya existe uno activo. Nuevos administradores se crean desde la gestión autenticada. Creación y comprobación se serializan en la misma transacción.

## Evidencia histórica de S1

24 pruebas aprobadas: 19 backend (unitarias/HTTP e integración real MySQL) y 5 UI React Testing Library. Se probaron login incorrecto/correcto, cookie/expiración, revocación, 401/403 por rol, CSRF, origen, límite 429, hash, email duplicado, grupo sin responsable, capacidad, responsable inválida, concurrencia, último ADMIN, baja lógica, permisos SQL, auditoría, EJS/escape y formularios/rutas de UI.

El primer pase detectó defaults incorrectos en PATCH que desactivaban grupos; se corrigió y conservó una prueba de regresión. Se corrigió el hostname del proxy de Vite tras una comprobación HTTP real. Login/me/usuarios/grupos/EJS/OpenAPI/logout volvieron a responder correctamente después de recrear los servicios, confirmando persistencia del ADMIN.

Build de React aprobado. Lint de backend/frontend aprobado (reglas básicas de sintaxis, sin afirmar cobertura completa de estilo). npm ci de ambas imágenes aprobado. No se ha medido cobertura porcentual, p95, disponibilidad ni realizado backup/restore: corresponden a verificación posterior; no se afirman esos objetivos cumplidos. La interfaz está probada con DOM simulado, no con revisión visual manual en tablet.

Desde guarderia-web:

```powershell
docker compose --profile test run --build --rm integration
docker compose run --rm --no-deps frontend npm test
docker compose run --rm --no-deps frontend npm run build
docker compose run --rm --no-deps frontend npm run lint
docker compose run --rm --no-deps backend npm run lint
docker compose run --rm --no-deps backend npm run build
```

La integración solo permite DB_HOST=mysql-test y usa su volumen separado. Los datos son ficticios; los tests conservan evidencia, no borran tablas y sus identificadores son únicos por ejecución. En la prueba del último ADMIN se cambian únicamente registros de la base de pruebas. No ejecutar tests contra mysql de desarrollo.

No se crearon commits: cambios disponibles en el workspace para revisión. Pendiente revisión manual/académica de S1 antes de marcar la entrega como cerrada.

## Contrato de API S1

Todas las rutas API llevan /api/v1. Respuestas: data, message, error; logout 204 sin cuerpo. OpenAPI con esquemas y ejemplos disponible en /api/v1/openapi.json.

| Método | Ruta | Acceso |
|---|---|---|
| GET | /health, /openapi.json | Público, sin datos personales |
| POST | /auth/login | Público, limitado |
| GET | /auth/me | Los cuatro roles autenticados |
| POST | /auth/logout | Autenticado + CSRF |
| GET / POST | /usuarios | ADMIN; POST + CSRF |
| PATCH | /usuarios/:id | ADMIN + CSRF, baja mediante activo=false |
| GET / POST | /grupos | ADMIN; POST + CSRF |
| PATCH | /grupos/:id | ADMIN + CSRF |
| GET | /grupos/categorias | ADMIN |
| GET | /reportes/grupos (fuera de /api/v1) | ADMIN, HTML EJS |

Errores: 400 payload/identificador, 401 sesión/credenciales, 403 rol/origen/CSRF, 404 recurso, 409 duplicado/estado concurrente, 413 tamaño, 422 regla de grupo, 429 intentos, 500 inesperado y 503 salud sin DB. Mensajes de error no revelan SQL ni secretos.

## Seis entregas acumulativas

| Entrega | Fecha académica | Alcance |
|---|---|---|
| S1 | 22/oct/2026 | Arquitectura, autenticación, usuarios, grupos, EJS |
| S2 | 29/oct/2026 | Menores, documentos privados, personas, preinscripciones |
| S3 | 05/nov/2026 | Recepción, filtro médico e intentos persistidos |
| S4 | 12/nov/2026 | Aula, dosis, inventario, alertas y comedor |
| S5 | 19/nov/2026 | Enfermería, salidas, retardos y reportes |
| S6 | 26/nov/2026 | Finanzas, auditoría, respaldos/restauración y cierre |

## Contradicciones y decisiones pendientes

Se identificaron antes de implementar. Las decisiones propuestas no se presentan como requisitos confirmados del docente.

| ID | Contradicción o ambigüedad | Tratamiento y estado |
|---|---|---|
| D01 | Cuatro sprints/ocho semanas frente a seis entregas semanales | Seguir S1–S6 del maestro; obligatorio según §8. |
| D02 | «ejshbs» frente a React/EJS | EJS funcional en S1; HBS pendiente de confirmación docente. |
| D03 | «3 años 365 días» frente a menor de cuatro años | Fechas civiles: desde 30 días hasta antes del cuarto cumpleaños. |
| D04 | Hasta 09:00/16:00 frente a ejemplos 09:01/16:01 | Propuesta configurable: inicio inclusivo, fin exclusivo; no implementar sin registrar el criterio final. |
| D05 | Entregante matutino cualquiera frente a historia de autorizados | Seguir regla detallada: identidad condicional en ingreso, autorización estricta en salida. |
| D06 | Tres principales, auxiliares y gafetes | No confundir personas con gafetes. Tres auxiliares obligatorios; conteo de principales y protocolo de portador pendientes. |
| D07 | «Hasta cuatro meses antes del parto» | Intervalo exacto pendiente; no activar automáticamente. |
| D08 | Reporte DIF frente a envío oficial | Solo generar/exportar; sin transporte ni estado ENVIADO ficticio. |
| D09 | Biometría mencionada frente a integración no confirmada | Identificación y check; sin biometría real. |
| D10 | Mora: aviso frente a posible bloqueo | Avisar; bloqueo no autorizado por la especificación actual. |
| D11 | Baja lógica frente a integridad inalterable | Auditoría transaccional, privilegios limitados y backups; soft delete no basta. Retención pendiente. |
| D12 | Token JSON/hora cliente frente a cookies/reloj servidor | Cookie HttpOnly y sesiones revocables; reloj servidor. Preservar rutas de fuente y alias exigido. |
| D13 | Cuatro roles frente a auditor DIF | No añadir quinto rol; exportación administrada. |
| D14 | Tres retardos frente a prórrogas de pagos | Contadores y aprobaciones independientes. Usuario confirma contador anual por persona autorizada que efectivamente recoge (`id_persona`); implementación de aprobación pendiente. |

## Especificación principal completa (fuente preservada)

# DOCUMENTO MAESTRO DE IMPLEMENTACIÓN — SISTEMA DE GUARDERÍA INFANTIL

**Versión:** 1.0 | **Fecha de referencia:** 20 de octubre de 2026 | **Idioma de implementación:** español para dominio, inglés para bibliotecas.  
**Destinatario:** Codex o agente de desarrollo que debe construir el proyecto sin requerir los archivos de origen.  
**Estado:** especificación consolidada para desarrollo académico; no representa certificación de cumplimiento legal ni pruebas de despliegue.

## 0. INSTRUCCIONES VINCULANTES PARA CODEX

1. Este documento es la fuente operativa única para implementar el proyecto. Desarrollar seis entregables acumulativos, funcionales y comprobables; no crear pantallas ficticias ni endpoints sin persistencia.
2. Distinguir **OBLIGATORIO** (requisito de los documentos), **DECISIÓN DE DISEÑO** (propuesta para implementar) y **PENDIENTE DE CONFIRMACIÓN** (ambigüedad). No presentar decisiones como si el docente las hubiera exigido.
3. El SQL completo se reproduce en el apéndice A. Es la base de referencia v2, **no ha sido probado en una instancia MySQL real**. Antes de implementar, ejecutar en MySQL 8.0.16+, detectar fallos y registrar migraciones incrementales; no borrar datos ni ejecutar DROP sobre entornos con información.
4. Ante contradicciones, conservar ambas fuentes en el registro de decisiones, aplicar una interpretación segura y configurable y documentarla en README. Nunca inventar una integración oficial con el DIF.
5. Datos de pruebas exclusivamente ficticios. Los datos de salud, identificaciones y menores son sensibles: acceso mínimo, archivos privados, auditoría y sin logs de secretos.
6. Cada entrega debe incluir código, migraciones, pruebas, documentación de API, instrucciones de ejecución y evidencia de funcionamiento. No declarar terminado algo que no se haya ejecutado y verificado.
7. React es el frontend principal. Express expone API REST y renderiza vistas EJS para reportes. **'ejshbs' es una expresión ambigua del docente**: incluir EJS funcional y dejar HBS como extensión opcional hasta confirmar si pidió ambos; no afirmar que el requisito está resuelto sin esa confirmación.

## 1. VISIÓN, ALCANCE Y ACTORES

**Objetivo:** sistema integral para admisión, registro, recepción, inspección, salud, administración de medicamentos, aula, comedor, inventario de insumos, enfermería, recolección segura, cuotas, alertas y auditoría de una guardería infantil. Priorizar seguridad de menores, trazabilidad y control de acceso.

**Roles obligatorios:** ADMIN (configuración, expedientes, finanzas, auditoría); RECEPCION (ingreso, inspección, verificación, salida); EDUCADORA (aula, alimentación, insumos y alertas autorizadas); ENFERMERIA (recetas, administración según política, incidentes, peso y talla). La matriz de permisos precisa debe codificarse por endpoint y registrarse en pruebas. El auditor DIF es un actor de consulta mencionado en la planificación, **no** uno de los cuatro roles de login especificados: acceso mediante exportación administrada o rol adicional únicamente con autorización explícita.

**Fuera del alcance confirmado:** lector físico real de tarjetas, biometría integrada, pasarela de pagos, envío electrónico oficial al DIF, aplicaciones móviles nativas, mensajería SMS/WhatsApp. Se pueden usar códigos escritos/escaneables, check y exportaciones sin fingir integraciones.

## 2. TECNOLOGÍAS Y CRITERIOS

| Capa | Tecnología | Uso |
|---|---|---|
| Frontend | React + Vite + React Router | SPA y rutas protegidas |
| HTTP cliente | Axios o fetch (elegir uno) | API REST con cookies y errores normalizados |
| Estado auth | Context API (AuthContext) | Usuario actual, carga y cierre de sesión |
| Backend | Node.js LTS + Express | APIs, validación, autorización, vistas EJS |
| Vistas servidor | EJS; HBS solo si se confirma | HTML imprimible de expediente, reporte diario y comprobante |
| Base de datos | MySQL 8.0.16+ InnoDB utf8mb4 | Persistencia, índices, claves, transacciones |
| Acceso SQL | mysql2/promise | Pool, consultas parametrizadas, transacciones |
| Autenticación | bcryptjs + jsonwebtoken | Hash de contraseña, JWT con expiración 8 horas |
| Cookies/sesiones | cookie-parser + cookie HttpOnly + tabla sesiones | Token, revocación y cierre de sesión |
| Seguridad | helmet, cors, rate limiter, CSRF | Protección HTTP, origen y operaciones mutables |
| Validación | Zod o express-validator | Validación estricta del payload en servidor |
| Tareas programadas | node-cron o scheduler persistente | Alertas; idempotencia y recuperación tras reinicio |
| Configuración | dotenv + .env.example | Secretos solo en backend; nunca commitear .env |
| Pruebas | Vitest/Jest, Supertest, React Testing Library | Unitarias, integración y UI |
| Documentación | OpenAPI/Swagger + README | Contratos y operación |

**DECISIÓN:** evitar almacenar JWT en localStorage. Enviar cookie HttpOnly, Secure en HTTPS, SameSite acorde al despliegue, protección CSRF para acciones mutables. No usar express-session simultáneamente como un segundo login independiente: si se exige explícitamente, reservarlo para una funcionalidad separada y documentar su almacenamiento y seguridad. La tabla `sesiones` controla JWT activos. Contraseñas siempre con hash, nunca cifrado reversible.

## 3. ESTRUCTURA DE REPOSITORIO REQUERIDA

```text
guarderia-web/
  frontend/
    public/
    src/
      api/{client.js,endpoints.js}
      assets/
      components/{common,forms,layout}/
      context/AuthContext.jsx
      hooks/
      modules/{auth,dashboard,usuarios,grupos,menores,tutores,preinscripciones,recepcion,aulas,medicamentos,insumos,comedor,enfermeria,salidas,pagos,auditoria}/
      routes/{AppRouter.jsx,ProtectedRoute.jsx}
      utils/
      App.jsx
      main.jsx
    .env.example
    package.json
  backend/
    src/
      config/{database.js,env.js,cors.js,viewEngines.js}
      middlewares/{authMiddleware.js,roleMiddleware.js,validateMiddleware.js,errorMiddleware.js,rateLimitMiddleware.js,csrfMiddleware.js}
      modules/{auth,usuarios,grupos,menores,tutores,preinscripciones,recepcion,aulas,medicamentos,insumos,comedor,enfermeria,salidas,pagos,auditoria}/
      jobs/{alertasMedicamentos.job.js,alertasDIF.job.js,alertasInsumos.job.js}
      routes/{index.js,views.routes.js}
      services/
      utils/
      app.js
      server.js
    views/ejs/{reporteDiario.ejs,expedienteMenor.ejs,comprobantePago.ejs}
    tests/{unit,integration}
    .env.example
    package.json
  database/{migrations,seeds,schema_completo_v2.sql}
  docs/{api,diagramas,pruebas,decisiones,manual_usuario}
  .gitignore
  README.md
```

**Convención backend por módulo:** `modulo.routes.js` (rutas), `modulo.controller.js` (HTTP), `modulo.service.js` (reglas/transacciones), `modulo.repository.js` (SQL parametrizado), `modulo.validation.js` (esquemas). El controller no contiene SQL ni reglas de negocio. No exponer `password_hash`, hashes de gafetes, rutas privadas ni identificaciones completas en respuestas JSON.

## 4. REQUERIMIENTOS FUNCIONALES DETALLADOS

### RF-01 Admisibilidad y expediente
- Ingreso exclusivamente de niños con **30 días cumplidos** y **antes de su cuarto cumpleaños**. A los 29 días se rechaza; en el cuarto cumpleaños ya se rechaza. Comparar fechas civiles en zona horaria operativa, no dividir días por 365.
- Debe existir expediente, inscripción activa y validación de Registro Civil antes de aceptar ingreso; un preinscrito no puede figurar como activo sin validación.
- Grupos G0: 30 días a antes de 1 año; G1: 1 a antes de 2; G2: 2 a antes de 3; G3: 3 a antes de 4. Capacidad, responsable y cambios de grupo auditados.
- Preinscripción de embarazo hasta cuatro meses antes del parto según los documentos; **la interpretación exacta del intervalo es ambigua**, parametrizar/regla documentada, no activar automáticamente al cumplir 30 días.
- Documentos de acta/registro civil, CURP, identificaciones con acceso privado; validar integridad y tipo MIME, tamaño, permisos.

### RF-02 Recepción 08:00–09:00
- Buscar por código/ID del menor y desplegar ficha, personas autorizadas, alertas, requerimientos y bitácora. No se requiere lector físico real.
- Hora la decide el servidor en zona horaria de la guardería, nunca el cliente. Rechazar fuera de ventana y guardar **intento rechazado** con causa; no crear asistencia.
- Inspección física obligatoria al ingreso: menores de un año en área de cunero con protocolo de privacidad; mayores de un año revisión visual rápida. Guardar fecha, responsable, lesiones, ubicación, causa declarada y seguimiento a lesiones previas.
- Una persona cualquiera puede dejar al menor sano, sin obligación de registrar su identidad. Si hay lesión, enfermedad o pendiente relevante, guardar nombre y parentesco de quien lo lleva. **Existe contradicción** con una historia que limita también entregantes: seguir especificación detallada hasta aclaración docente.
- Si falta insumo obligatorio o requisito médico, rechazar. Si repone antes del cierre de ventana, permitir nuevo intento.

### RF-03 Filtro médico
- Si hay enfermedad/síntomas, receta vigente de médico con nombre y cédula profesional, fecha de consulta y autorización **explícita de convivencia con población general**. Si falta o hay indicio de contagio incompatible, rechazar y registrar causa.
- Tratamiento solo de sustancias prescritas: nombre, dosis numérica y unidad, vía, horarios, inicio y fin; no permitir té, crema u otros no prescritos. Para dosis que requiere medición, exigir dosificador graduado entregado; cuchara convencional no cumple.
- Dietas temporales por enfermedad requieren receta y vigencia; alergias/restricciones basales del expediente se distinguen de dietas temporales. No permitir administrar fuera de receta o fechas.

### RF-04 Aula y medicamentos
- Dashboard táctil para tablet, lista de niños presentes del grupo asignado, plan de actividades, registros y alertas de dosis oral/tópica.
- Avisos visuales y sonoros al horario prescrito; persistir programación para evitar pérdida si el navegador se cierra. Registrar aplicación/omisión, hora real, empleado y dosis; evitar duplicados.
- Inventario individual de pañales, leche y requerimientos variables (ropa, cobija, otros). Registrar entradas, consumos, ajustes, saldo y responsable; alertas 3/2/1 días estimados; bloquear ingreso cuando no alcance el mínimo obligatorio (día cero).

### RF-05 Comedor
- Traslado registrado para niños mayores de un año según documentación; validar presencia y acompañamiento. Registrar ración NADA/CUARTO/MEDIA/TRES_CUARTOS/COMPLETA, hora y responsable.
- Aplicar alergias y restricciones temporales respaldadas por receta. Impedir asignación de alimentos incompatibles; no inferir seguridad de dieta únicamente por etiqueta.

### RF-06 Enfermería
- Primeros auxilios, incidentes, acciones y solicitud de recolección urgente. Guardar responsable, hora y relación con asistencia cuando exista.
- Peso y talla **mensual obligatoria** de población activa y por incidente; histórico y reporte de cobertura mensual. Evitar duplicación mensual sin impedir mediciones por incidentes.

### RF-07 Salida 15:00–16:00
- Solo tutores/principales y hasta tres auxiliares autorizados vigentes, o gafete válido conforme al protocolo. La especificación habla de hasta tres principales y tres gafetes de invitado; el límite de auxiliares también figura como tres. Validar vínculo del **mismo menor**, identidad, restricción judicial, vigencia y confirmación/firma/check.
- Registrar persona que recoge, portador de gafete si aplica, método de verificación, empleado, hora y resumen diario. No entregar si identidad/autorización no coincide. Biometría es alternativa mencionada, no integración implementada.
- A las 16:00/16:01 según definición final, generar alerta/reporte por menores no recogidos. Tres justificaciones anuales **avaladas** por tutor/persona según especificación, nunca automáticas sin aprobación. Si no hay aviso o se exceden tolerancias, generar reporte a autoridad. **Solo generar y registrar reporte; no simular envío oficial DIF**.

### RF-08 Administración, pagos, bajas y auditoría
- Usuarios, aulas, expedientes, preinscripciones, altas/bajas/expulsiones con historial. Cuotas semanales, pagos parciales, saldos, prórrogas, vencimientos, avisos de mora.
- Conservar historia médica, asistencias, movimientos, salidas y cambios; usar baja lógica, permisos SQL sin DELETE para usuario de aplicación, registro de auditoría. Los documentos piden integridad inalterable; **soft delete por sí solo no garantiza inmutabilidad**: registrar antes/después y limitar modificaciones, respaldar diariamente.
- Exportar expediente/auditoría y reporte imprimible EJS; no exponer datos a roles no autorizados.

## 5. REQUERIMIENTOS NO FUNCIONALES

- RNF-01 seguridad: JWT 8 h, roles ADMIN/RECEPCION/EDUCADORA/ENFERMERIA, cookies seguras, CSRF, rate limit login, validación, SQL parametrizado, privacidad y datos ficticios en desarrollo.
- RNF-02 rendimiento: objetivo API <200 ms y ficha tras escaneo <1 segundo en condiciones de prueba definidas; medir p95, hardware, tamaño de dataset y red, no prometer sin medición.
- RNF-03 disponibilidad: objetivo 99.5% en horario operativo; backups MySQL diarios, recuperación verificada y monitoreo.
- RNF-04 usabilidad: interfaz táctil tablet, botones accesibles, errores claros, estados de carga, teclado y contraste.
- RNF-05 historia: soft delete y no borrado físico en flujos de negocio, auditoría de cambios, retención según política legal por definir.
- RNF-06 zona horaria: fechas civiles de guardería consistentes y `DATETIME`/ISO interpretados correctamente; timestamps UTC en intercambio cuando aplique.
- RNF-07 calidad: pruebas automatizadas de reglas críticas, logs sin datos sensibles, documentación reproducible, CI opcional.

## 6. CONTRATO DE API, ERRORES Y SEGURIDAD

**Prefijo:** `/api/v1`. Respuestas JSON `data`, `message` y `error` consistente. Estados: 200 lectura/actualización, 201 creación, 204 cierre sin cuerpo, 400 formato, 401 sin sesión, 403 rol, 404 recurso, 409 conflicto de estado, 422 regla de negocio, 429 límite, 500 inesperado. Documentar cada endpoint OpenAPI y ejemplos de error. No confiar en `hora_ingreso` ni `hora_salida` del cliente; si llegan, tratarlas como datos informativos y nunca como autoridad.

| Método | Ruta | Roles sugeridos | Resultado |
|---|---|---|---|
| POST | /auth/login | Público | Cookie JWT y usuario |
| POST | /auth/logout | Autenticado | Revocar sesión y borrar cookie |
| GET | /auth/me | Autenticado | Perfil actual |
| GET/POST/PATCH | /usuarios | ADMIN | CRUD lógico empleados |
| GET/POST/PATCH | /grupos | ADMIN | Gestión aulas |
| GET/POST/PATCH | /admin/menores | ADMIN, RECEPCION según operación | Expediente |
| GET/POST/PATCH | /preinscripciones | ADMIN | Reservas |
| GET/POST/PATCH | /menores/:id/autorizados | ADMIN, RECEPCION | Vínculos |
| GET | /recepcion/menor/:codigo | RECEPCION | Ficha recepción |
| POST | /recepcion/ingreso | RECEPCION | Intento + posible asistencia |
| POST | /recepcion/salida | RECEPCION | Entrega validada |
| POST | /recetas | ENFERMERIA, ADMIN | Receta |
| POST | /medicamentos/administraciones | ENFERMERIA, EDUCADORA según política | Dosis aplicada |
| GET | /aulas/:id/monitor | EDUCADORA, ADMIN | Presentes y alertas |
| POST | /insumos/movimientos | EDUCADORA, RECEPCION | Movimiento de stock |
| POST | /comedor/registros | EDUCADORA | Ración |
| POST | /enfermeria/mediciones | ENFERMERIA | Peso/talla |
| POST | /enfermeria/atenciones | ENFERMERIA | Incidente |
| GET/POST | /cuotas, /pagos, /prorrogas | ADMIN | Finanzas |
| GET | /admin/auditoria-dif/menor/:id | ADMIN | Historial/exportación |
| GET | /reportes/expediente/:id | ADMIN | HTML EJS imprimible |

**Contratos de fuente que deben preservarse:** `POST /auth/login`, `POST /admin/menores`, `POST /recepcion/ingreso`, `PUT /aulas/insumos/descontar` (mantener como alias si se adopta `/insumos/movimientos`), `POST /recepcion/salida`, `GET /admin/auditoria-dif/menor/:id`. Los ejemplos del plan contienen tokens JSON y timestamps enviados por cliente: **adaptar a cookie HttpOnly y reloj de servidor sin romper el comportamiento requerido**.

### Flujos transaccionales obligatorios

**Ingreso:** autenticar rol → buscar menor y bloquear filas relevantes → validar activo/edad/hora/registro civil → revisar inspección y recetas/insumos → registrar intento → si aceptado, crear asistencia única → auditar → COMMIT. Si rechazado, registrar intento y causa; evitar rollback que borre la evidencia. Las operaciones de lectura de stock deben ser consistentes.

**Salida:** autenticar → asistencia sin entrega → hora y condiciones → autorización/gafete mismo menor → identidad y restricción → registrar entrega única → auditar → COMMIT. Rechazo sin entrega y con evento auditado.

**Inventario:** `SELECT ... FOR UPDATE` del insumo individual → calcular delta/saldo no negativo → actualizar saldo → insertar movimiento y aviso si corresponde → COMMIT. Idempotencia en reintentos del cliente.

**Medicamento:** validar receta, tratamiento, horario, día, rol y estado pendiente → bloquear dosis → registrar aplicada u omitida con actor/hora → auditar → COMMIT. Nunca permitir dos aplicaciones para la misma programación.

**Retardo/DIF:** tarea programada idempotente revisa asistencias sin entrega y justificaciones aprobadas, registra alerta/reporte único; un reporte generado no significa enviado.

## 7. CONFIGURACIÓN Y EJECUCIÓN

Backend `.env.example` (sin secretos reales):
```dotenv
NODE_ENV=development
PORT=3000
FRONTEND_ORIGIN=http://localhost:5173
DB_HOST=localhost
DB_PORT=3306
DB_USER=guarderia_app
DB_PASSWORD=REEMPLAZAR
DB_NAME=guarderia
JWT_SECRET=REEMPLAZAR_CON_SECRETO_LARGO_ALEATORIO
JWT_EXPIRES_IN=8h
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
TZ=America/Mexico_City
UPLOAD_PRIVATE_DIR=./private_uploads
```
Frontend `.env.example`:
```dotenv
VITE_API_BASE_URL=http://localhost:3000/api/v1
```
**Importante:** Vite expone al cliente cualquier `VITE_*`; jamás poner secretos allí. CORS con origen explícito y credenciales habilitadas, `axios.withCredentials=true`; proxy seguro en despliegue y `trust proxy` configurado solo si corresponde. HTTPS obligatorio en producción.

Comandos esperados: `npm install`, `npm run dev`, `npm run test`, `npm run build`, `npm run lint` (definir scripts reales en cada package.json). Base inicial por SQL del apéndice A; migraciones versionadas después de su verificación. Datos semilla ficticios, usuario admin inicial creado por script seguro con contraseña suministrada en ejecución, nunca hardcodeada.

## 8. CRONOGRAMA Y CRITERIOS DE ENTREGA (SEIS HITOS)

**Plan vigente de seis entregas:** inicio 15/oct/2026; S1 22/oct; S2 29/oct; S3 05/nov; S4 12/nov; S5 19/nov; S6 26/nov/2026. El PDF técnico antiguo habla de cuatro sprints en ocho semanas; priorizar este plan detallado de seis entregas y registrar discrepancia.


### 8.1 S1 — 22 OCT 2026 — Arquitectura, autenticación y aulas
**Historias:** HU-01 / HU-02. **Alcance implementable:** Monorepo; MySQL verificado con migraciones; Express y React ejecutables; login/logout/me con JWT 8h en cookie, tabla sesiones y revocación; roles y protección de rutas; CRUD usuarios, grupos, asignación de educadoras; EJS configurado con vista de prueba funcional.

**Criterios de aceptación:** Login correcto e incorrecto, 401/403, cookie segura según entorno, cierre revoca token, usuarios no ven roles ajenos, grupo sin responsable no se habilita, tests y README reproducibles.

**Artefactos exigidos:** commits integrados; migraciones y seeds de prueba; endpoints documentados; tests unitarios/integración/UI; capturas o registro de pruebas; README de ejecución; lista de incidencias y decisiones. **No avanzar como completado sin verificación de persistencia y reglas.**


### 8.2 S2 — 29 OCT 2026 — Expediente infantil y preinscripciones
**Historias:** HU-03 / HU-04. **Alcance implementable:** CRUD menores, documentos privados, validación Registro Civil, grupos por cumpleaños, preinscripciones, personas/tutores/auxiliares, hasta 3 auxiliares y gafetes; wizard React con validaciones; historial de grupos.

**Criterios de aceptación:** Rechazar menor fuera de edad para recepción, permitir expediente pendiente, no activar sin documentos, no más de 3 auxiliares aun con peticiones concurrentes, vínculo de personas reutilizable, documentos protegidos.

**Artefactos exigidos:** commits integrados; migraciones y seeds de prueba; endpoints documentados; tests unitarios/integración/UI; capturas o registro de pruebas; README de ejecución; lista de incidencias y decisiones. **No avanzar como completado sin verificación de persistencia y reglas.**


### 8.3 S3 — 05 NOV 2026 — Recepción y filtro médico
**Historias:** HU-05 / HU-06. **Alcance implementable:** Escaneo/código; ficha y bitácora; recepción 8–9; inspección según edad; lesiones previas y acompañante condicional; recetas, médicos, dosificador, dietas; intentos aceptados/rechazados; bloqueo por insumos.

**Criterios de aceptación:** Rechazos documentados sin asistencia, duplicados prevenidos, menor 29 días/4 años rechazado, receta sin convivencia o dosificador rechazada, reintento tras reposición dentro de horario, pruebas reloj controlado.

**Artefactos exigidos:** commits integrados; migraciones y seeds de prueba; endpoints documentados; tests unitarios/integración/UI; capturas o registro de pruebas; README de ejecución; lista de incidencias y decisiones. **No avanzar como completado sin verificación de persistencia y reglas.**


### 8.4 S4 — 12 NOV 2026 — Aulas, alertas, insumos y comedor
**Historias:** HU-07 / HU-08. **Alcance implementable:** Monitor tablet por aula; actividades; dosis programadas y alertas sonoras/visuales; consumo/entrada/ajuste de insumos; avisos 3/2/1 y bloqueo 0; traslados y raciones; restricciones alimentarias.

**Criterios de aceptación:** No duplicar dosis, no stock negativo, saldo calculado transaccionalmente, alertas persistentes tras reinicio, dietas vigentes visibles, acceso por grupo y tablet utilizable.

**Artefactos exigidos:** commits integrados; migraciones y seeds de prueba; endpoints documentados; tests unitarios/integración/UI; capturas o registro de pruebas; README de ejecución; lista de incidencias y decisiones. **No avanzar como completado sin verificación de persistencia y reglas.**


### 8.5 S5 — 19 NOV 2026 — Enfermería, salida y DIF
**Historias:** HU-09 / HU-10. **Alcance implementable:** Atenciones, peso/talla mensual e incidentes, cobertura mensual; salida 15–16 con vínculo/gafete y check; bitácora diaria; retardos justificados; generación de reportes DIF no recogidos.

**Criterios de aceptación:** Persona no autorizada rechazada, una salida por asistencia, sin aviso genera reporte, máximo 3 justificaciones aprobadas por año, job idempotente, sin afirmar envío oficial, reporte EJS imprimible.

**Artefactos exigidos:** commits integrados; migraciones y seeds de prueba; endpoints documentados; tests unitarios/integración/UI; capturas o registro de pruebas; README de ejecución; lista de incidencias y decisiones. **No avanzar como completado sin verificación de persistencia y reglas.**


### 8.6 S6 — 26 NOV 2026 — Finanzas, auditoría y cierre
**Historias:** HU-11 / HU-12. **Alcance implementable:** Cuotas semanales, pagos, prórrogas, saldos; bajas lógicas; historial completo y exportaciones; EJS comprobante y expediente; pruebas de integración, rendimiento, backup/restore, documentación y entrega.

**Criterios de aceptación:** Pago parcial/saldo correctos, sin sobrepago no autorizado, baja conserva histórico, exportación solo ADMIN, backup restaurable, test de extremo a extremo y guía de despliegue.

**Artefactos exigidos:** commits integrados; migraciones y seeds de prueba; endpoints documentados; tests unitarios/integración/UI; capturas o registro de pruebas; README de ejecución; lista de incidencias y decisiones. **No avanzar como completado sin verificación de persistencia y reglas.**


## 9. MODELO DE DATOS: CATÁLOGO COMPLETO Y POLÍTICAS

El esquema v2 incluye 41 tablas. Se reproducen abajo por módulo y el SQL íntegro se incluye en apéndice A para que Codex no necesite otro archivo. **Advertencia:** la presencia de una columna o FK no prueba automáticamente reglas cruzadas entre entidades. Validar con servicios transaccionales y tests.

| Módulo | Tablas | Responsabilidad |
|---|---|---|
| Seguridad | roles, usuarios, sesiones, configuracion_operativa | RBAC, sesiones, parámetros |
| Aulas | categorias_edad, grupos, asignaciones_educadoras | edades, capacidad, responsables |
| Expedientes | preinscripciones, menores, historial_grupos, documentos_menor | alta y documentos |
| Autorizados | personas, menor_persona, gafetes | autorizaciones y tarjetas |
| Recepción | intentos_ingreso, asistencias, inspecciones, lesiones | control de entrada |
| Salud | recetas, tratamientos, horarios_tratamiento, administraciones_medicamento, restricciones_alimentarias | prescripción y ejecución |
| Insumos | tipos_insumo, insumos_menor, movimientos_insumo, avisos_insumo | inventario y avisos |
| Aula/comedor | actividades_aula, participaciones_actividad, traslados_comedor, registros_alimentacion | cuidado diario |
| Enfermería | atenciones_enfermeria, mediciones, alertas_recoleccion | salud y seguimiento |
| Salida | entregas, retardos, reportes_autoridad | entrega segura |
| Finanzas | cuotas, pagos, prorrogas | cobranza |
| Auditoría | auditoria_eventos | trazabilidad |

**Integridad a verificar:** `asistencias.id_menor` debe coincidir con `intentos_ingreso.id_menor`; `entregas.id_vinculo` y `id_gafete` deben pertenecer al menor de la asistencia; `restricciones_alimentarias.id_receta` debe pertenecer al mismo menor; atención vinculada a asistencia del mismo menor; participación en actividad de grupo/fecha coherentes; solo una asignación activa de responsable por grupo; rangos de historial sin solapamientos. Estas condiciones no quedan completamente garantizadas por las FK existentes.

**Riesgos del esquema v2 que Codex debe resolver mediante migraciones y pruebas, NO ignorar:**
1. `categorias_edad` G0 tiene mínimo 0 años; mínimo 30 días debe validarse por separado.
2. `gafetes` guarda hasta tres números por menor pero el vínculo entre portador e identidad no está predefinido: documentar protocolo de gafete compartido y verificación manual.
3. `mediciones` tiene `UNIQUE(id_menor,tipo,periodo_mensual)`; para `INCIDENTE` periodo NULL permite múltiples, intencional.
4. `intentos_ingreso` no tiene FK de persona acompañante; usa nombre/parentesco libre cuando es necesario, intencional.
5. `configuracion_operativa` contiene un solo registro id=1; modificar únicamente mediante ADMIN auditado.
6. `reportes_autoridad` registra estado ENVIADO pero ningún transporte oficial está definido: nunca marcar ENVIADO sin referencia externa verificable.
7. `pagos` permite registrar importes que en suma superen cuota; controlar saldo con transacción y bloqueo.
8. `auditoria_eventos` permite edición/borrado si el usuario SQL tiene privilegios; restringir permisos y establecer respaldo y registro de cambios.
9. Las recetas y rutas de documentos requieren almacenamiento privado cifrado/controles de acceso y política de conservación.
10. Algunos nombres del SQL v2 difieren de ejemplos del PDF (`recetas_medicamentos`, `incidencias_bitacora`, `cuotas_pagos`); mantener contratos de API y mapear a las tablas normalizadas.

## 10. MATRIZ DE PRUEBAS MÍNIMAS (CASOS CONCRETOS)

| ID | Caso | Esperado |
|---|---|---|
| T01 | Login válido y contraseña incorrecta | 200 con cookie / 401 sin filtrar usuario |
| T02 | JWT revocado o expirado | 401 |
| T03 | RECEPCION accede a finanzas | 403 |
| T04 | Menor de 29 días, 30 días y cuarto cumpleaños | rechazo / aceptación condicional / rechazo |
| T05 | Entrada 07:59, 08:15, 09:01 | rechazo / aceptación / rechazo |
| T06 | Dos ingresos simultáneos mismo menor/día | solo una asistencia |
| T07 | Niño enfermo sin receta, sin convivencia o sin dosificador | rechazar y conservar motivo |
| T08 | Lesión con acompañante sin nombre | rechazar validación de captura |
| T09 | Insumo día 3,2,1,0 | aviso, aviso, aviso, bloqueo |
| T10 | Dos consumos concurrentes que agotan saldo | no saldo negativo |
| T11 | Dosis repetida | impedir duplicado |
| T12 | Restricción dietética temporal vencida | no aplicar como vigente; conservar historia |
| T13 | Auxiliar número 4 simultáneo | impedir |
| T14 | Salida con vínculo de otro menor | rechazar |
| T15 | Salida 14:59 y 15:30 | rechazar / aceptar si autorizado |
| T16 | No recogido tras 16:00 sin aviso | generar un reporte, no duplicados |
| T17 | Cuarta justificación anual | rechazar aprobación |
| T18 | Medición mensual faltante | mostrar pendiente en cierre mensual |
| T19 | Pago parcial y doble pago concurrente | saldo exacto sin sobrepago |
| T20 | Baja de menor | no puede ingresar, historia íntegra |
| T21 | Acceso a receta/INE sin rol | 403 sin fuga de ruta |
| T22 | Reporte EJS y exportación | datos correctos, sin filtraciones |

## 11. DECISIONES PENDIENTES, CONTRADICCIONES Y SUPUESTOS

- **Motor de plantillas:** profesor dijo 'no utilizó ejshbs'; no es nombre técnico inequívoco. EJS obligatorio por decisión provisional; HBS condicional a confirmación. React sigue como interfaz principal.
- **Cronograma:** PDF técnico = 4 sprints / 8 semanas; planificación detallada = 6 entregas semanales. Seguir 6 entregas.
- **Edad:** la expresión '3 años 365 días' es imprecisa; prevalece 'menor de cuatro años' y 30 días mínimos.
- **Horario:** texto exige no después de 09:00 y salida hasta 16:00; ejemplo de planificación menciona 09:01 y reporte 16:01. Configurar criterio preciso de borde (p.ej. `08:00:00 <= t < 09:00:00`, `15:00:00 <= t < 16:00:00`) como decisión provisional y documentarlo.
- **Personas:** especificación permite cualquier entregante sano por la mañana, mientras una historia dice solo autorizados para entregar o recoger; adoptar la regla detallada para recepción, restringir estrictamente recolección.
- **3 principales/3 auxiliares/3 gafetes:** distinguir personas nominativas y gafetes compartidos; confirmar conteo exacto de principales, y usar límites configurables con validación transaccional.
- **Tolerancias:** tres retardos justificados anuales y prórrogas de pagos son conceptos distintos. No usar el mismo contador.
- **Preinscripción:** 'hasta cuatro meses antes del parto' requiere interpretación temporal y documentación.
- **DIF:** reportar internamente y exportar; el envío a la autoridad requiere canal oficial no documentado.
- **Biometría:** opcional en documento técnico, no recopilar ni almacenar biometría real por defecto; check + identificación.
- **Cuotas impagas:** se exige aviso en recepción, pero no se define bloqueo obligatorio de ingreso por mora; mostrar alerta, no bloquear salvo aprobación docente.
- **Legislación:** los documentos describen reglas académicas, no son validación jurídica ni determinan plazos legales de retención.

## 12. DEFINITION OF DONE FINAL Y ENTREGA A DOCENTE

- Código frontend/backend completo, con `npm install`, `.env.example`, scripts y ejecución reproducible.
- SQL instalado en MySQL real, migraciones y seeds ficticios, integridad referencial comprobada.
- Roles, login/logout, rutas protegidas, EJS real, APIs REST documentadas y módulos conectados.
- Pruebas automatizadas y manuales de las reglas críticas, reporte de cobertura y defectos abiertos.
- Backups diarios configurados y restauración ensayada; archivos sensibles fuera de carpeta pública.
- README, diagrama ER generado del esquema real, guía de despliegue, manual por rol, evidencia de seis entregas.
- Registro explícito de decisiones no confirmadas y de funciones no implementadas; jamás afirmar integración DIF o biometría si no existen.

## APÉNDICE A — SCRIPT SQL COMPLETO DE REFERENCIA (41 TABLAS)

**Reproducido íntegramente del archivo `schema_completo_v2.sql` existente.** Debe validarse ejecutándolo en MySQL antes de darlo por definitivo. No contiene `DROP` ni datos personales reales.

```sql
-- GUARDERIA | Esquema integral v2.0 | MySQL 8.0.16+ (CHECK aplicado)
-- EJECUTAR SOLO EN UNA BASE NUEVA. No contiene DROP ni datos personales reales.
-- Fechas operativas: zona America/Mexico_City; establecer zona en la conexion de Express.
CREATE DATABASE IF NOT EXISTS guarderia CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE guarderia;

-- 01 SEGURIDAD
CREATE TABLE roles (
 id_rol SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 codigo VARCHAR(30) NOT NULL UNIQUE, nombre VARCHAR(70) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE usuarios (
 id_usuario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_rol SMALLINT UNSIGNED NOT NULL, nombre VARCHAR(160) NOT NULL,
 email VARCHAR(190) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
 activo BOOLEAN NOT NULL DEFAULT TRUE, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 deleted_at DATETIME NULL,
 CONSTRAINT fk_usuario_rol FOREIGN KEY(id_rol) REFERENCES roles(id_rol)
) ENGINE=InnoDB;
CREATE TABLE sesiones (
 id_sesion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_usuario BIGINT UNSIGNED NOT NULL, jti_hash CHAR(64) NOT NULL UNIQUE,
 emitida_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, expira_at DATETIME NOT NULL,
 revocada_at DATETIME NULL, ip_hash CHAR(64) NULL, agente_usuario VARCHAR(255) NULL,
 INDEX ix_sesiones_usuario (id_usuario,revocada_at,expira_at),
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 CHECK(expira_at > emitida_at)
) ENGINE=InnoDB;
CREATE TABLE configuracion_operativa (
 id_config TINYINT UNSIGNED PRIMARY KEY, zona_horaria VARCHAR(60) NOT NULL DEFAULT 'America/Mexico_City',
 hora_inicio_ingreso TIME NOT NULL DEFAULT '08:00:00', hora_fin_ingreso TIME NOT NULL DEFAULT '09:00:00',
 hora_inicio_salida TIME NOT NULL DEFAULT '15:00:00', hora_fin_salida TIME NOT NULL DEFAULT '16:00:00',
 edad_minima_dias SMALLINT UNSIGNED NOT NULL DEFAULT 30,
 max_auxiliares TINYINT UNSIGNED NOT NULL DEFAULT 3,
 max_tolerancias_anuales TINYINT UNSIGNED NOT NULL DEFAULT 3,
 CHECK (id_config=1), CHECK(hora_inicio_ingreso < hora_fin_ingreso),
 CHECK(hora_inicio_salida < hora_fin_salida)
) ENGINE=InnoDB;

-- 02 AULAS Y PERSONAL
CREATE TABLE categorias_edad (
 id_categoria SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 codigo VARCHAR(10) NOT NULL UNIQUE, nombre VARCHAR(80) NOT NULL,
 edad_min_anios TINYINT UNSIGNED NOT NULL, edad_max_anios_exclusiva TINYINT UNSIGNED NOT NULL,
 CHECK(edad_max_anios_exclusiva > edad_min_anios)
) ENGINE=InnoDB;
CREATE TABLE grupos (
 id_grupo BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_categoria SMALLINT UNSIGNED NOT NULL, codigo VARCHAR(20) NOT NULL UNIQUE,
 nombre VARCHAR(100) NOT NULL, capacidad SMALLINT UNSIGNED NOT NULL,
 activo BOOLEAN NOT NULL DEFAULT TRUE, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(id_categoria) REFERENCES categorias_edad(id_categoria), CHECK(capacidad > 0)
) ENGINE=InnoDB;
CREATE TABLE asignaciones_educadoras (
 id_asignacion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_grupo BIGINT UNSIGNED NOT NULL, id_usuario BIGINT UNSIGNED NOT NULL,
 responsable BOOLEAN NOT NULL DEFAULT FALSE, fecha_inicio DATE NOT NULL, fecha_fin DATE NULL,
 FOREIGN KEY(id_grupo) REFERENCES grupos(id_grupo), FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 INDEX ix_asignaciones_grupo (id_grupo,fecha_inicio,fecha_fin),
 CHECK(fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
) ENGINE=InnoDB;

-- 03 PREINSCRIPCION Y EXPEDIENTES
CREATE TABLE preinscripciones (
 id_preinscripcion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 nombre_contacto VARCHAR(160) NOT NULL, telefono_contacto VARCHAR(30) NOT NULL,
 email_contacto VARCHAR(190) NULL, fecha_probable_parto DATE NOT NULL,
 fecha_solicitud DATE NOT NULL, estado ENUM('PENDIENTE','EN_ESPERA','CONFIRMADA','CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
 observaciones TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_preinscripciones_estado (estado,fecha_probable_parto)
) ENGINE=InnoDB;
CREATE TABLE menores (
 id_menor BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 codigo VARCHAR(40) NOT NULL UNIQUE, id_preinscripcion BIGINT UNSIGNED NULL UNIQUE,
 nombres VARCHAR(100) NOT NULL, apellido_paterno VARCHAR(100) NOT NULL,
 apellido_materno VARCHAR(100) NULL, fecha_nacimiento DATE NOT NULL,
 curp CHAR(18) NULL UNIQUE, registro_civil_validado BOOLEAN NOT NULL DEFAULT FALSE,
 estatus ENUM('PENDIENTE','ACTIVO','BAJA','EXPULSADO') NOT NULL DEFAULT 'PENDIENTE',
 fecha_alta DATE NULL, motivo_baja TEXT NULL, deleted_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(id_preinscripcion) REFERENCES preinscripciones(id_preinscripcion),
 INDEX ix_menores_estado (estatus,fecha_nacimiento)
) ENGINE=InnoDB;
CREATE TABLE historial_grupos (
 id_historial BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, id_grupo BIGINT UNSIGNED NOT NULL,
 fecha_inicio DATE NOT NULL, fecha_fin DATE NULL, motivo VARCHAR(200) NULL,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor), FOREIGN KEY(id_grupo) REFERENCES grupos(id_grupo),
 INDEX ix_historial_grupo_menor (id_menor,fecha_inicio,fecha_fin),
 CHECK(fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
) ENGINE=InnoDB;
CREATE TABLE documentos_menor (
 id_documento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, tipo ENUM('ACTA_NACIMIENTO','CURP','OTRO') NOT NULL,
 ruta_segura VARCHAR(500) NOT NULL, hash_sha256 CHAR(64) NULL,
 validado BOOLEAN NOT NULL DEFAULT FALSE, validado_por BIGINT UNSIGNED NULL,
 registrado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor), FOREIGN KEY(validado_por) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;

-- 04 PERSONAS Y GAFETES (tutores principales y auxiliares se cuentan por vinculo)
CREATE TABLE personas (
 id_persona BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 nombre VARCHAR(180) NOT NULL, telefono VARCHAR(30) NULL,
 tipo_identificacion VARCHAR(40) NULL, identificacion_referencia VARCHAR(120) NULL,
 identificacion_ruta_segura VARCHAR(500) NULL, activo BOOLEAN NOT NULL DEFAULT TRUE,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE menor_persona (
 id_vinculo BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, id_persona BIGINT UNSIGNED NOT NULL,
 tipo ENUM('PRINCIPAL','AUXILIAR') NOT NULL, parentesco VARCHAR(70) NOT NULL,
 puede_recoger BOOLEAN NOT NULL DEFAULT TRUE, restriccion_judicial BOOLEAN NOT NULL DEFAULT FALSE,
 respaldo_restriccion VARCHAR(500) NULL, fecha_inicio DATE NOT NULL, fecha_fin DATE NULL,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor), FOREIGN KEY(id_persona) REFERENCES personas(id_persona),
 INDEX ix_vinculos_autorizados (id_menor,tipo,fecha_fin,puede_recoger),
 CHECK(fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
) ENGINE=InnoDB;
CREATE TABLE gafetes (
 id_gafete BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, numero TINYINT UNSIGNED NOT NULL,
 codigo_hash CHAR(64) NOT NULL UNIQUE,
 estado ENUM('ACTIVO','REVOCADO','EXTRAVIADO') NOT NULL DEFAULT 'ACTIVO',
 fecha_emision DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor),
 UNIQUE(id_menor,numero), CHECK(numero BETWEEN 1 AND 3)
) ENGINE=InnoDB;

-- 05 RECEPCION: intentos separados de asistencias aceptadas
CREATE TABLE intentos_ingreso (
 id_intento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, id_usuario BIGINT UNSIGNED NOT NULL,
 intento_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 resultado ENUM('ACEPTADO','RECHAZADO') NOT NULL, motivo_rechazo TEXT NULL,
 nombre_acompanante VARCHAR(180) NULL, parentesco_acompanante VARCHAR(70) NULL,
 sintomas BOOLEAN NOT NULL DEFAULT FALSE, observaciones TEXT NULL,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor), FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 INDEX ix_intentos_menor_fecha (id_menor,intento_at),
 CHECK(resultado='ACEPTADO' OR motivo_rechazo IS NOT NULL)
) ENGINE=InnoDB;
CREATE TABLE asistencias (
 id_asistencia BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, id_intento BIGINT UNSIGNED NOT NULL UNIQUE,
 fecha DATE NOT NULL, ingreso_at DATETIME NOT NULL,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor), FOREIGN KEY(id_intento) REFERENCES intentos_ingreso(id_intento),
 UNIQUE(id_menor,fecha), INDEX ix_asistencias_fecha (fecha)
) ENGINE=InnoDB;
CREATE TABLE inspecciones (
 id_inspeccion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_intento BIGINT UNSIGNED NOT NULL UNIQUE,
 realizada_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 tiene_lesiones BOOLEAN NOT NULL DEFAULT FALSE, presenta_sintomas BOOLEAN NOT NULL DEFAULT FALSE,
 area ENUM('CUNERO','GENERAL') NOT NULL, observaciones TEXT NULL,
 FOREIGN KEY(id_intento) REFERENCES intentos_ingreso(id_intento)
) ENGINE=InnoDB;
CREATE TABLE lesiones (
 id_lesion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_inspeccion BIGINT UNSIGNED NOT NULL, id_lesion_anterior BIGINT UNSIGNED NULL,
 ubicacion VARCHAR(160) NOT NULL, descripcion TEXT NOT NULL, causa_reportada TEXT NULL,
 FOREIGN KEY(id_inspeccion) REFERENCES inspecciones(id_inspeccion),
 FOREIGN KEY(id_lesion_anterior) REFERENCES lesiones(id_lesion)
) ENGINE=InnoDB;

-- 06 RECETAS, MEDICAMENTOS Y DIETAS
CREATE TABLE recetas (
 id_receta BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, nombre_medico VARCHAR(180) NOT NULL,
 cedula_profesional VARCHAR(50) NOT NULL, fecha_consulta DATE NOT NULL,
 vigencia_inicio DATE NOT NULL, vigencia_fin DATE NOT NULL,
 permite_convivencia BOOLEAN NOT NULL, diagnostico VARCHAR(255) NULL,
 ruta_documento VARCHAR(500) NOT NULL, verificada_por BIGINT UNSIGNED NULL,
 verificada_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor),
 FOREIGN KEY(verificada_por) REFERENCES usuarios(id_usuario),
 INDEX ix_recetas_vigencia (id_menor,vigencia_inicio,vigencia_fin),
 CHECK(vigencia_fin >= vigencia_inicio)
) ENGINE=InnoDB;
CREATE TABLE tratamientos (
 id_tratamiento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_receta BIGINT UNSIGNED NOT NULL, medicamento VARCHAR(180) NOT NULL,
 dosis DECIMAL(10,3) NOT NULL, unidad VARCHAR(30) NOT NULL,
 via ENUM('ORAL','TOPICA','OTRA') NOT NULL,
 fecha_inicio DATE NOT NULL, fecha_fin DATE NOT NULL,
 dosificador_requerido BOOLEAN NOT NULL DEFAULT TRUE,
 dosificador_entregado BOOLEAN NOT NULL DEFAULT FALSE,
 indicaciones TEXT NULL, FOREIGN KEY(id_receta) REFERENCES recetas(id_receta),
 CHECK(dosis > 0), CHECK(fecha_fin >= fecha_inicio)
) ENGINE=InnoDB;
CREATE TABLE horarios_tratamiento (
 id_horario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_tratamiento BIGINT UNSIGNED NOT NULL, hora TIME NOT NULL,
 FOREIGN KEY(id_tratamiento) REFERENCES tratamientos(id_tratamiento), UNIQUE(id_tratamiento,hora)
) ENGINE=InnoDB;
CREATE TABLE administraciones_medicamento (
 id_administracion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_horario BIGINT UNSIGNED NOT NULL, fecha_programada DATE NOT NULL,
 estado ENUM('PENDIENTE','APLICADA','OMITIDA') NOT NULL DEFAULT 'PENDIENTE',
 aplicada_at DATETIME NULL, id_usuario BIGINT UNSIGNED NULL,
 dosis_aplicada DECIMAL(10,3) NULL, observaciones TEXT NULL,
 FOREIGN KEY(id_horario) REFERENCES horarios_tratamiento(id_horario),
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 UNIQUE(id_horario,fecha_programada),
 CHECK(dosis_aplicada IS NULL OR dosis_aplicada > 0),
 CHECK(estado <> 'APLICADA' OR (aplicada_at IS NOT NULL AND id_usuario IS NOT NULL AND dosis_aplicada IS NOT NULL))
) ENGINE=InnoDB;
CREATE TABLE restricciones_alimentarias (
 id_restriccion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, id_receta BIGINT UNSIGNED NULL,
 tipo ENUM('ALERGIA_BASE','DIETA_MEDICA_TEMPORAL','OTRA') NOT NULL,
 descripcion VARCHAR(255) NOT NULL, inicio DATE NOT NULL, fin DATE NULL,
 activa BOOLEAN NOT NULL DEFAULT TRUE,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor), FOREIGN KEY(id_receta) REFERENCES recetas(id_receta),
 CHECK(fin IS NULL OR fin >= inicio),
 CHECK(tipo <> 'DIETA_MEDICA_TEMPORAL' OR (id_receta IS NOT NULL AND fin IS NOT NULL))
) ENGINE=InnoDB;

-- 07 INSUMOS (saldo + movimientos auditables)
CREATE TABLE tipos_insumo (
 id_tipo_insumo BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 nombre VARCHAR(120) NOT NULL UNIQUE, unidad VARCHAR(40) NOT NULL, activo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;
CREATE TABLE insumos_menor (
 id_insumo_menor BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, id_tipo_insumo BIGINT UNSIGNED NOT NULL,
 cantidad_actual DECIMAL(12,3) NOT NULL DEFAULT 0,
 consumo_diario_estimado DECIMAL(12,3) NULL,
 cantidad_requerida_ingreso DECIMAL(12,3) NOT NULL DEFAULT 0,
 obligatorio BOOLEAN NOT NULL DEFAULT TRUE, activo BOOLEAN NOT NULL DEFAULT TRUE,
 observaciones VARCHAR(255) NULL,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor),
 FOREIGN KEY(id_tipo_insumo) REFERENCES tipos_insumo(id_tipo_insumo),
 UNIQUE(id_menor,id_tipo_insumo),
 CHECK(cantidad_actual >= 0), CHECK(consumo_diario_estimado IS NULL OR consumo_diario_estimado > 0),
 CHECK(cantidad_requerida_ingreso >= 0)
) ENGINE=InnoDB;
CREATE TABLE movimientos_insumo (
 id_movimiento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_insumo_menor BIGINT UNSIGNED NOT NULL,
 tipo ENUM('ENTRADA','CONSUMO','AJUSTE') NOT NULL,
 cantidad_delta DECIMAL(12,3) NOT NULL,
 saldo_resultante DECIMAL(12,3) NOT NULL,
 id_usuario BIGINT UNSIGNED NOT NULL,
 registrado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 motivo VARCHAR(255) NULL,
 FOREIGN KEY(id_insumo_menor) REFERENCES insumos_menor(id_insumo_menor),
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 CHECK(cantidad_delta <> 0), CHECK(saldo_resultante >= 0),
 CHECK((tipo='ENTRADA' AND cantidad_delta > 0) OR (tipo='CONSUMO' AND cantidad_delta < 0) OR tipo='AJUSTE')
) ENGINE=InnoDB;
CREATE TABLE avisos_insumo (
 id_aviso BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_insumo_menor BIGINT UNSIGNED NOT NULL, fecha DATE NOT NULL,
 dias_estimados TINYINT UNSIGNED NOT NULL,
 notificado_por BIGINT UNSIGNED NOT NULL, observaciones VARCHAR(255) NULL,
 FOREIGN KEY(id_insumo_menor) REFERENCES insumos_menor(id_insumo_menor),
 FOREIGN KEY(notificado_por) REFERENCES usuarios(id_usuario),
 UNIQUE(id_insumo_menor,fecha,dias_estimados), CHECK(dias_estimados BETWEEN 0 AND 3)
) ENGINE=InnoDB;

-- 08 AULA, COMEDOR, ENFERMERIA
CREATE TABLE actividades_aula (
 id_actividad BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_grupo BIGINT UNSIGNED NOT NULL, fecha DATE NOT NULL,
 titulo VARCHAR(160) NOT NULL, descripcion TEXT NULL, id_educadora BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY(id_grupo) REFERENCES grupos(id_grupo), FOREIGN KEY(id_educadora) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;
CREATE TABLE participaciones_actividad (
 id_actividad BIGINT UNSIGNED NOT NULL, id_asistencia BIGINT UNSIGNED NOT NULL,
 observaciones TEXT NULL, PRIMARY KEY(id_actividad,id_asistencia),
 FOREIGN KEY(id_actividad) REFERENCES actividades_aula(id_actividad),
 FOREIGN KEY(id_asistencia) REFERENCES asistencias(id_asistencia)
) ENGINE=InnoDB;
CREATE TABLE traslados_comedor (
 id_traslado BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_asistencia BIGINT UNSIGNED NOT NULL, entrada_at DATETIME NOT NULL,
 salida_at DATETIME NULL, id_responsable BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY(id_asistencia) REFERENCES asistencias(id_asistencia),
 FOREIGN KEY(id_responsable) REFERENCES usuarios(id_usuario),
 CHECK(salida_at IS NULL OR salida_at >= entrada_at)
) ENGINE=InnoDB;
CREATE TABLE registros_alimentacion (
 id_registro BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_asistencia BIGINT UNSIGNED NOT NULL, tipo_comida VARCHAR(50) NOT NULL,
 racion ENUM('NADA','CUARTO','MEDIA','TRES_CUARTOS','COMPLETA') NOT NULL,
 observaciones TEXT NULL, registrado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 id_usuario BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY(id_asistencia) REFERENCES asistencias(id_asistencia),
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;
CREATE TABLE atenciones_enfermeria (
 id_atencion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, id_asistencia BIGINT UNSIGNED NULL,
 id_usuario BIGINT UNSIGNED NOT NULL, atendido_at DATETIME NOT NULL,
 motivo TEXT NOT NULL, acciones TEXT NULL, requiere_recoleccion BOOLEAN NOT NULL DEFAULT FALSE,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor),
 FOREIGN KEY(id_asistencia) REFERENCES asistencias(id_asistencia),
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;
CREATE TABLE mediciones (
 id_medicion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, id_atencion BIGINT UNSIGNED NULL,
 id_usuario BIGINT UNSIGNED NOT NULL, fecha DATE NOT NULL,
 peso_kg DECIMAL(6,3) NOT NULL, talla_cm DECIMAL(6,2) NOT NULL,
 tipo ENUM('MENSUAL','INCIDENTE') NOT NULL,
 periodo_mensual DATE NULL,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor),
 FOREIGN KEY(id_atencion) REFERENCES atenciones_enfermeria(id_atencion),
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 INDEX ix_mediciones_menor (id_menor,fecha),
 UNIQUE(id_menor,tipo,periodo_mensual),
 CHECK(peso_kg > 0), CHECK(talla_cm > 0),
 CHECK((tipo='MENSUAL' AND periodo_mensual IS NOT NULL AND DAYOFMONTH(periodo_mensual)=1)
    OR (tipo='INCIDENTE' AND periodo_mensual IS NULL))
) ENGINE=InnoDB;
CREATE TABLE alertas_recoleccion (
 id_alerta BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_atencion BIGINT UNSIGNED NOT NULL, creada_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 motivo TEXT NOT NULL, estado ENUM('PENDIENTE','CONTACTADO','CERRADO') NOT NULL DEFAULT 'PENDIENTE',
 FOREIGN KEY(id_atencion) REFERENCES atenciones_enfermeria(id_atencion)
) ENGINE=InnoDB;

-- 09 SALIDAS, RETARDOS, AUTORIDAD
CREATE TABLE entregas (
 id_entrega BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_asistencia BIGINT UNSIGNED NOT NULL UNIQUE,
 id_vinculo BIGINT UNSIGNED NULL, id_gafete BIGINT UNSIGNED NULL,
 nombre_portador_gafete VARCHAR(180) NULL,
 identidad_verificada BOOLEAN NOT NULL, metodo_verificacion ENUM('DOCUMENTO','CHECK','BIOMETRIA_EXTERNA') NOT NULL,
 confirmacion BOOLEAN NOT NULL, evidencia_confirmacion VARCHAR(500) NULL,
 entregado_at DATETIME NOT NULL, id_usuario BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY(id_asistencia) REFERENCES asistencias(id_asistencia),
 FOREIGN KEY(id_vinculo) REFERENCES menor_persona(id_vinculo),
 FOREIGN KEY(id_gafete) REFERENCES gafetes(id_gafete),
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 CHECK(id_vinculo IS NOT NULL OR id_gafete IS NOT NULL),
 CHECK(id_gafete IS NULL OR nombre_portador_gafete IS NOT NULL),
 CHECK(identidad_verificada=TRUE AND confirmacion=TRUE)
) ENGINE=InnoDB;
CREATE TABLE retardos (
 id_retardo BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_asistencia BIGINT UNSIGNED NOT NULL UNIQUE,
 id_persona BIGINT UNSIGNED NULL, aviso_at DATETIME NULL,
 justificacion TEXT NULL, evidencia VARCHAR(500) NULL,
 estado ENUM('PENDIENTE','APROBADO','RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
 aprobado_por BIGINT UNSIGNED NULL, aprobado_at DATETIME NULL,
 anio SMALLINT UNSIGNED NOT NULL,
 FOREIGN KEY(id_asistencia) REFERENCES asistencias(id_asistencia),
 FOREIGN KEY(id_persona) REFERENCES personas(id_persona),
 FOREIGN KEY(aprobado_por) REFERENCES usuarios(id_usuario),
 INDEX ix_retardos_persona_anio (id_persona,anio,estado),
 CHECK(estado <> 'APROBADO' OR (aprobado_por IS NOT NULL AND aprobado_at IS NOT NULL))
) ENGINE=InnoDB;
CREATE TABLE reportes_autoridad (
 id_reporte BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_asistencia BIGINT UNSIGNED NOT NULL, tipo ENUM('NO_RECOGIDO','INCIDENTE','OTRO') NOT NULL,
 generado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 estado ENUM('GENERADO','REVISADO','ENVIADO','CANCELADO') NOT NULL DEFAULT 'GENERADO',
 referencia_envio VARCHAR(160) NULL, enviado_at DATETIME NULL,
 documento_ruta VARCHAR(500) NULL, id_usuario BIGINT UNSIGNED NULL,
 FOREIGN KEY(id_asistencia) REFERENCES asistencias(id_asistencia),
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 UNIQUE(id_asistencia,tipo),
 CHECK(estado <> 'ENVIADO' OR (enviado_at IS NOT NULL AND referencia_envio IS NOT NULL))
) ENGINE=InnoDB;

-- 10 FINANZAS
CREATE TABLE cuotas (
 id_cuota BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_menor BIGINT UNSIGNED NOT NULL, periodo_inicio DATE NOT NULL,
 periodo_fin DATE NOT NULL, vencimiento DATE NOT NULL,
 importe DECIMAL(12,2) NOT NULL, estado ENUM('PENDIENTE','ANULADA') NOT NULL DEFAULT 'PENDIENTE',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(id_menor) REFERENCES menores(id_menor),
 UNIQUE(id_menor,periodo_inicio,periodo_fin),
 CHECK(periodo_fin >= periodo_inicio), CHECK(importe >= 0)
) ENGINE=InnoDB;
CREATE TABLE pagos (
 id_pago BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_cuota BIGINT UNSIGNED NOT NULL, importe DECIMAL(12,2) NOT NULL,
 pagado_at DATETIME NOT NULL, metodo ENUM('EFECTIVO','TRANSFERENCIA','TARJETA','OTRO') NOT NULL,
 referencia VARCHAR(150) NULL, id_usuario BIGINT UNSIGNED NOT NULL,
 estado ENUM('REGISTRADO','ANULADO') NOT NULL DEFAULT 'REGISTRADO',
 motivo_anulacion VARCHAR(255) NULL,
 FOREIGN KEY(id_cuota) REFERENCES cuotas(id_cuota),
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario), CHECK(importe > 0)
) ENGINE=InnoDB;
CREATE TABLE prorrogas (
 id_prorroga BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_cuota BIGINT UNSIGNED NOT NULL, nueva_fecha DATE NOT NULL,
 motivo TEXT NOT NULL, id_usuario BIGINT UNSIGNED NOT NULL,
 autorizada_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(id_cuota) REFERENCES cuotas(id_cuota), FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;

-- 11 AUDITORIA (escribir desde servicios backend dentro de la misma transaccion)
CREATE TABLE auditoria_eventos (
 id_evento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_usuario BIGINT UNSIGNED NULL, entidad VARCHAR(90) NOT NULL,
 entidad_id BIGINT UNSIGNED NOT NULL, accion VARCHAR(70) NOT NULL,
 detalle JSON NULL, creado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
 INDEX ix_auditoria_entidad (entidad,entidad_id,creado_at),
 INDEX ix_auditoria_fecha (creado_at)
) ENGINE=InnoDB;

INSERT INTO roles(codigo,nombre) VALUES
 ('ADMIN','Administracion'),('RECEPCION','Recepcion'),
 ('EDUCADORA','Educadora'),('ENFERMERIA','Enfermeria');
INSERT INTO categorias_edad(codigo,nombre,edad_min_anios,edad_max_anios_exclusiva) VALUES
 ('G0','Lactantes menores de un anio',0,1),
 ('G1','Un anio a menos de dos',1,2),
 ('G2','Dos anios a menos de tres',2,3),
 ('G3','Tres anios a menos de cuatro',3,4);
INSERT INTO configuracion_operativa(id_config) VALUES (1);
INSERT INTO tipos_insumo(nombre,unidad) VALUES
 ('Panales','pieza'),('Leche especial','ml'),('Cambios de ropa','juego'),('Cobija','pieza');
-- NOTA: Crear grupos concretos y asignar educadora responsable antes de activar menores.
-- NOTA: No se insertan usuarios con contrasenas predeterminadas.
```


## APÉNDICE B — ORIGEN Y TRAZABILIDAD

El contenido obligatorio se consolidó de: (1) *Documentación Técnica e Inicial de Arquitectura*, 5 páginas, con RF-01 a RF-08, RNF-01 a RNF-05, módulos, arquitectura y plan original de cuatro sprints; (2) *Especificación de Requerimientos del Sistema de Guardería*, 7 páginas, transcripción y reglas detalladas de recepción, salud, insumos, personas y horarios; (3) *Planificación Estratégica de Sprints, Épicas e Historias de Usuario*, con HU-01 a HU-12, contratos API, seis fechas y Definition of Done; (4) *schema_completo_v2.sql*, 41 tablas; y (5) *README_esquema_v2.md*, notas de diseño, limitaciones y pruebas pendientes.

**El presente documento reemplaza esos archivos como contexto de implementación para Codex**, pero conserva las ambigüedades identificadas; no convierte decisiones provisionales en requisitos expresos. Codex debe informar las dudas bloqueantes y registrar sus decisiones.

