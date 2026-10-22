-- Catálogos inmutables y evidencia de composición; se conserva el SQL de referencia.
CREATE TABLE IF NOT EXISTS ingredientes_comedor (
 id_ingrediente BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 nombre VARCHAR(100) NOT NULL UNIQUE, registrado_por BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY(registrado_por) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS platillos_comedor (
 id_platillo BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 nombre VARCHAR(160) NOT NULL, ingredientes JSON NOT NULL, registrado_por BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY(registrado_por) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='restricciones_alimentarias' AND column_name='revision_comedor');
SET @ddl=IF(@n=0,'ALTER TABLE restricciones_alimentarias ADD COLUMN revision_comedor JSON NULL','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='traslados_comedor' AND column_name='clave_idempotencia');
SET @ddl=IF(@n=0,'ALTER TABLE traslados_comedor ADD COLUMN clave_idempotencia VARCHAR(100) NULL UNIQUE, ADD COLUMN solicitud_hash CHAR(64) NULL','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='registros_alimentacion' AND column_name='id_platillo');
SET @ddl=IF(@n=0,'ALTER TABLE registros_alimentacion ADD COLUMN id_platillo BIGINT UNSIGNED NULL, ADD COLUMN comprobacion JSON NULL, ADD COLUMN clave_idempotencia VARCHAR(100) NULL UNIQUE, ADD COLUMN solicitud_hash CHAR(64) NULL, ADD FOREIGN KEY(id_platillo) REFERENCES platillos_comedor(id_platillo)','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
INSERT INTO auditoria_eventos(id_usuario,entidad,entidad_id,accion,detalle)
SELECT NULL,'migraciones',6,'APLICAR',JSON_OBJECT('archivo','006_comedor.sql') WHERE NOT EXISTS(SELECT 1 FROM auditoria_eventos WHERE entidad='migraciones' AND entidad_id=6 AND accion='APLICAR');
