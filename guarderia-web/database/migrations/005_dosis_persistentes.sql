-- S4: resolución auditada e idempotencia; sin borrar información.
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='tratamientos' AND column_name='suspendido');
SET @ddl=IF(@n=0,'ALTER TABLE tratamientos ADD COLUMN suspendido BOOLEAN NOT NULL DEFAULT FALSE','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='administraciones_medicamento' AND column_name='resuelta_at');
SET @ddl=IF(@n=0,'ALTER TABLE administraciones_medicamento ADD COLUMN resuelta_at DATETIME NULL','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='administraciones_medicamento' AND column_name='clave_idempotencia');
SET @ddl=IF(@n=0,'ALTER TABLE administraciones_medicamento ADD COLUMN clave_idempotencia VARCHAR(100) NULL UNIQUE','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='administraciones_medicamento' AND column_name='solicitud_hash');
SET @ddl=IF(@n=0,'ALTER TABLE administraciones_medicamento ADD COLUMN solicitud_hash CHAR(64) NULL','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
INSERT INTO auditoria_eventos(id_usuario,entidad,entidad_id,accion,detalle)
SELECT NULL,'migraciones',5,'APLICAR',JSON_OBJECT('archivo','005_dosis_persistentes.sql')
WHERE NOT EXISTS (SELECT 1 FROM auditoria_eventos WHERE entidad='migraciones' AND entidad_id=5 AND accion='APLICAR');
