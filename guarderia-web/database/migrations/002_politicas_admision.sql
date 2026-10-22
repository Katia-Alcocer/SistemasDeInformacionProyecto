-- S2: agregar parámetros solo si no existen, conservando el esquema de referencia.
SET @exists_col=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='configuracion_operativa' AND column_name='max_principales');
SET @ddl=IF(@exists_col=0,'ALTER TABLE configuracion_operativa ADD COLUMN max_principales TINYINT UNSIGNED NOT NULL DEFAULT 3, ADD COLUMN max_gafetes TINYINT UNSIGNED NOT NULL DEFAULT 3, ADD COLUMN preinscripcion_meses TINYINT UNSIGNED NOT NULL DEFAULT 4','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
INSERT INTO auditoria_eventos(id_usuario,entidad,entidad_id,accion,detalle)
SELECT NULL,'migraciones',2,'APLICAR',JSON_OBJECT('archivo','002_politicas_admision.sql')
WHERE NOT EXISTS (SELECT 1 FROM auditoria_eventos WHERE entidad='migraciones' AND entidad_id=2 AND accion='APLICAR');
