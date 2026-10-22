-- Entregas idempotentes y evidencia histórica; no elimina información.
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='entregas' AND column_name='resumen_diario');
SET @ddl=IF(@n=0,'ALTER TABLE entregas ADD COLUMN resumen_diario JSON NULL, ADD COLUMN identidad_receptor JSON NULL','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='entregas' AND column_name='clave_idempotencia');
SET @ddl=IF(@n=0,'ALTER TABLE entregas ADD COLUMN clave_idempotencia VARCHAR(100) NULL UNIQUE, ADD COLUMN solicitud_hash CHAR(64) NULL','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
INSERT INTO auditoria_eventos(id_usuario,entidad,entidad_id,accion,detalle)
SELECT NULL,'migraciones',7,'APLICAR',JSON_OBJECT('archivo','007_salida_segura.sql') WHERE NOT EXISTS(SELECT 1 FROM auditoria_eventos WHERE entidad='migraciones' AND entidad_id=7 AND accion='APLICAR');
