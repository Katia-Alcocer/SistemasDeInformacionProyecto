-- S6: idempotencia de extensiones de vencimiento sin modificar historial previo.
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='prorrogas' AND column_name='clave_idempotencia');
SET @ddl=IF(@n=0,'ALTER TABLE prorrogas ADD COLUMN clave_idempotencia VARCHAR(100) NULL UNIQUE, ADD COLUMN solicitud_hash CHAR(64) NULL','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
INSERT INTO auditoria_eventos(id_usuario,entidad,entidad_id,accion,detalle)
SELECT NULL,'migraciones',11,'APLICAR',JSON_OBJECT('archivo','011_prorrogas_idempotencia.sql') WHERE NOT EXISTS(SELECT 1 FROM auditoria_eventos WHERE entidad='migraciones' AND entidad_id=11 AND accion='APLICAR');
