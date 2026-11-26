# Entrega Sprint 6

Fecha de verificacion: 25 de noviembre de 2026.

## Estado final

Se conservaron las interfaces y estilos existentes. El incremento completa y verifica cuotas, pagos, prorrogas, anulacion auditable, baja logica, auditoria administrativa, historial operativo para ADMIN, preinscripciones maternas y respaldo/restauracion.

## Evidencia ejecutada

- Integracion MySQL real: 13 suites y 143 pruebas aprobadas.
- Backend JavaScript: todos los archivos pasan `node --check`.
- Respaldo: dump SQL de 141 KB, archivos privados cifrados de 344 KB y hashes SHA-256.
- Restauracion: instancia MySQL y volumen privado temporales; 43 tablas recuperadas y volumen privado extraido.
- Rendimiento de `GET /api/v1/health`: 50 solicitudes, p95 de 44.35 ms; hubo un maximo aislado de 2255.62 ms.
- Rendimiento autenticado de `GET /api/v1/admin/menores`: 30 solicitudes, p95 de 48.11 ms y maximo de 62.74 ms.

Las mediciones son una muestra local, no una certificacion de disponibilidad del 99.5% ni una prueba de carga. No se declara integracion oficial con DIF.

## Cambios de auditoria

`GET /api/v1/admin/auditoria-dif/menor/:id` ahora devuelve version 2 e incluye historiales de asistencia, lesiones, enfermeria, mediciones, medicamentos, alimentacion, actividades y salidas, ademas de eventos auditables. `GET /reportes/expediente/:id` muestra esas secciones en HTML imprimible para guardarlo como PDF desde el navegador.

No se incluyen archivos privados, rutas internas, hashes ni credenciales. El acceso continua limitado a ADMIN.

## Respaldo

Desde `guarderia-web`:

```powershell
$destino = Join-Path $env:TEMP 'guarderia-backup-AAAA-MM-DD'
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup.ps1 -OutputDirectory $destino
```

Para restaurar solo en una instancia temporal:

```powershell
$password = 'CONTRASENA_ROOT_DE_LA_INSTANCIA_TEMPORAL'
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\restore-isolated.ps1 -BackupDirectory $destino -MysqlPassword $password -ConfirmIsolated
```

Los respaldos deben permanecer fuera del repositorio. No ejecutar la restauracion contra `mysql` de desarrollo ni contra datos de produccion.

## Pendientes no declarados como completados

- Automatizacion de retencion y alertas de respaldos diarios.
- Prueba de disponibilidad continua y carga sostenida.
- Revision visual manual completa de todos los formularios nuevos.
