-- S6: idempotencia financiera y comprobante histórico del registro de pago.
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='cuotas' AND column_name='clave_idempotencia');
SET @ddl=IF(@n=0,'ALTER TABLE cuotas ADD COLUMN clave_idempotencia VARCHAR(100) NULL UNIQUE, ADD COLUMN solicitud_hash CHAR(64) NULL','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='pagos' AND column_name='clave_idempotencia');
SET @ddl=IF(@n=0,'ALTER TABLE pagos ADD COLUMN clave_idempotencia VARCHAR(100) NULL UNIQUE, ADD COLUMN solicitud_hash CHAR(64) NULL, ADD COLUMN comprobante JSON NULL','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
INSERT INTO auditoria_eventos(id_usuario,entidad,entidad_id,accion,detalle)
SELECT NULL,'migraciones',10,'APLICAR',JSON_OBJECT('archivo','010_finanzas.sql') WHERE NOT EXISTS(SELECT 1 FROM auditoria_eventos WHERE entidad='migraciones' AND entidad_id=10 AND accion='APLICAR');
