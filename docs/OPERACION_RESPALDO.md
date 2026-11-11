# Respaldo y restauración

Este procedimiento está documentado; todavía no se ha ejecutado ni restaurado una copia en esta instalación. No usarlo para afirmar que existe un respaldo verificado.

## Qué respaldar

La base `guarderia` y el volumen `guarderia_private_uploads` forman una sola unidad operativa: la base conserva referencias y metadatos de los documentos, mientras los bytes cifrados viven en el volumen privado. Guardar ambos archivos en un destino cifrado con acceso restringido, fuera del repositorio y del equipo que ejecuta Docker. Mantener una copia diaria y definir retención con la administración.

## Crear una copia

Ejecutar desde `guarderia-web` en Git Bash, con los servicios iniciados y un directorio de destino previamente creado. Sustituir `D:/resguardos/guarderia/AAAA-MM-DD` por el directorio aprobado para ese día. Estas órdenes no imprimen contraseñas:

```bash
mkdir -p /d/resguardos/guarderia/AAAA-MM-DD
docker compose exec -T mysql sh -ec 'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysqldump --user=root --single-transaction --routines --triggers --events --hex-blob guarderia' > /d/resguardos/guarderia/AAAA-MM-DD/guarderia.sql
docker compose exec -T backend sh -ec 'exec tar -czf - -C /app/private_uploads .' > /d/resguardos/guarderia/AAAA-MM-DD/private_uploads.tar.gz
sha256sum /d/resguardos/guarderia/AAAA-MM-DD/guarderia.sql /d/resguardos/guarderia/AAAA-MM-DD/private_uploads.tar.gz > /d/resguardos/guarderia/AAAA-MM-DD/SHA256SUMS
```

Revisar que los tres archivos tengan tamaño mayor a cero, que `sha256sum -c SHA256SUMS` pase y que el destino no esté dentro del repositorio. `--single-transaction` da consistencia transaccional al dump InnoDB; para que los documentos y sus referencias correspondan a un mismo instante, poner la aplicación en mantenimiento durante la copia o establecer una pausa operativa equivalente.

## Ensayar restauración

Hacer el ensayo en una instancia desechable aislada, nunca sobre el volumen vigente. Preparar una base `guarderia` vacía (sin tablas) y un volumen `private_uploads` nuevo, con la misma versión de MySQL y aplicación; verificar primero los hashes y restaurar en este orden. El dump crea las tablas; importarlo sobre tablas existentes puede fallar o mezclar estados:

```bash
sha256sum -c SHA256SUMS
docker compose exec -T mysql sh -ec 'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql --user=root guarderia' < guarderia.sql
docker compose exec -T backend sh -ec 'tar -xzf - -C /app/private_uploads' < private_uploads.tar.gz
```

Después comprobar conteos de tablas, lectura autorizada de un documento ficticio, salud de API, login de prueba y que ninguna ruta privada aparezca en respuestas. El ensayo solo cuenta como recuperación verificada cuando se registra fecha, versión, resultado y duración. No importar una copia sobre datos existentes sin un plan de recuperación aprobado: `mysql` puede sobrescribir filas.

## Limitaciones actuales

- No hay tarea automática de backup configurada en Compose.
- Este procedimiento requiere Git Bash, Docker Compose y `mysqldump`/`mysql` dentro de la imagen MySQL.
- Todavía falta automatizar retención y alertas por copia ausente.
- No se ha medido RPO/RTO ni completado un ensayo de restauración.
