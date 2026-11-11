-- S6: anulación auditable e idempotente; conserva pagos.comprobante sin cambios.
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='pagos' AND column_name='anulacion_clave_idempotencia');
SET @ddl=IF(@n=0,'ALTER TABLE pagos ADD COLUMN anulacion_clave_idempotencia VARCHAR(100) NULL UNIQUE','SELECT 1'); PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='pagos' AND column_name='anulacion_hash');
SET @ddl=IF(@n=0,'ALTER TABLE pagos ADD COLUMN anulacion_hash CHAR(64) NULL','SELECT 1'); PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='pagos' AND column_name='anulado_por');
SET @ddl=IF(@n=0,'ALTER TABLE pagos ADD COLUMN anulado_por BIGINT UNSIGNED NULL, ADD CONSTRAINT fk_pagos_anulado_por FOREIGN KEY (anulado_por) REFERENCES usuarios(id_usuario)','SELECT 1'); PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='pagos' AND column_name='anulado_at');
SET @ddl=IF(@n=0,'ALTER TABLE pagos ADD COLUMN anulado_at DATETIME NULL','SELECT 1'); PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='pagos' AND column_name='anulacion_respuesta');
SET @ddl=IF(@n=0,'ALTER TABLE pagos ADD COLUMN anulacion_respuesta JSON NULL','SELECT 1'); PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
INSERT INTO auditoria_eventos(id_usuario,entidad,entidad_id,accion,detalle)
SELECT NULL,'migraciones',12,'APLICAR',JSON_OBJECT('archivo','012_anulacion_pagos.sql') WHERE NOT EXISTS(SELECT 1 FROM auditoria_eventos WHERE entidad='migraciones' AND entidad_id=12 AND accion='APLICAR');
