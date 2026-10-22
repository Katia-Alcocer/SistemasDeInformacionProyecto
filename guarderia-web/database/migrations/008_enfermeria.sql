-- S5: idempotencia clínica y trazabilidad de recolección, sin borrar datos.
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='atenciones_enfermeria' AND column_name='clave_idempotencia');
SET @ddl=IF(@n=0,'ALTER TABLE atenciones_enfermeria ADD COLUMN clave_idempotencia VARCHAR(100) NULL UNIQUE, ADD COLUMN solicitud_hash CHAR(64) NULL','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='mediciones' AND column_name='clave_idempotencia');
SET @ddl=IF(@n=0,'ALTER TABLE mediciones ADD COLUMN clave_idempotencia VARCHAR(100) NULL UNIQUE, ADD COLUMN solicitud_hash CHAR(64) NULL','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='alertas_recoleccion' AND column_name='contactado_at');
SET @ddl=IF(@n=0,'ALTER TABLE alertas_recoleccion ADD COLUMN contactado_at DATETIME NULL, ADD COLUMN contactado_por BIGINT UNSIGNED NULL, ADD COLUMN detalle_contacto VARCHAR(1000) NULL, ADD COLUMN resuelta_at DATETIME NULL, ADD COLUMN motivo_cierre VARCHAR(1000) NULL','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
INSERT INTO auditoria_eventos(id_usuario,entidad,entidad_id,accion,detalle)
SELECT NULL,'migraciones',8,'APLICAR',JSON_OBJECT('archivo','008_enfermeria.sql') WHERE NOT EXISTS(SELECT 1 FROM auditoria_eventos WHERE entidad='migraciones' AND entidad_id=8 AND accion='APLICAR');
