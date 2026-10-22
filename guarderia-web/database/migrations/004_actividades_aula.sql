-- S4: idempotencia de actividades; no elimina registros ni crea tablas.
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='actividades_aula' AND column_name='clave_idempotencia');
SET @ddl=IF(@n=0,'ALTER TABLE actividades_aula ADD COLUMN clave_idempotencia VARCHAR(100) NULL UNIQUE','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='actividades_aula' AND column_name='solicitud_hash');
SET @ddl=IF(@n=0,'ALTER TABLE actividades_aula ADD COLUMN solicitud_hash CHAR(64) NULL','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
INSERT INTO auditoria_eventos(id_usuario,entidad,entidad_id,accion,detalle)
SELECT NULL,'migraciones',4,'APLICAR',JSON_OBJECT('archivo','004_actividades_aula.sql')
WHERE NOT EXISTS (SELECT 1 FROM auditoria_eventos WHERE entidad='migraciones' AND entidad_id=4 AND accion='APLICAR');
