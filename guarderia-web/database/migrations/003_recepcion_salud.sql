-- S3: migración repetible, sin borrar datos ni agregar tablas.
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='menores' AND column_name='requerimientos_insumos_revisados');
SET @ddl=IF(@n=0,'ALTER TABLE menores ADD COLUMN requerimientos_insumos_revisados BOOLEAN NOT NULL DEFAULT FALSE','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='documentos_menor' AND column_name='uso');
SET @ddl=IF(@n=0,'ALTER TABLE documentos_menor ADD COLUMN uso ENUM(''EXPEDIENTE'',''MEDICO'') NOT NULL DEFAULT ''EXPEDIENTE''','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='lesiones' AND column_name='estado');
SET @ddl=IF(@n=0,'ALTER TABLE lesiones ADD COLUMN estado ENUM(''ABIERTA'',''RESUELTA'') NOT NULL DEFAULT ''ABIERTA''','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='movimientos_insumo' AND column_name='clave_idempotencia');
SET @ddl=IF(@n=0,'ALTER TABLE movimientos_insumo ADD COLUMN clave_idempotencia VARCHAR(100) NULL UNIQUE, ADD COLUMN solicitud_hash CHAR(64) NULL','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
INSERT INTO auditoria_eventos(id_usuario,entidad,entidad_id,accion,detalle)
SELECT NULL,'migraciones',3,'APLICAR',JSON_OBJECT('archivo','003_recepcion_salud.sql')
WHERE NOT EXISTS (SELECT 1 FROM auditoria_eventos WHERE entidad='migraciones' AND entidad_id=3 AND accion='APLICAR');
