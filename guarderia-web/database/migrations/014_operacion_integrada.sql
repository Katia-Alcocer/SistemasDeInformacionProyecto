-- Integracion de enfermeria, recepcion, fotografias, menu y alergias.
-- Migracion repetible: no elimina ni sobrescribe informacion historica.
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='menores' AND column_name='foto_ruta_segura');
SET @ddl=IF(@n=0,'ALTER TABLE menores ADD COLUMN foto_ruta_segura VARCHAR(500) NULL, ADD COLUMN foto_hash_sha256 CHAR(64) NULL, ADD COLUMN foto_mime VARCHAR(40) NULL','SELECT 1'); PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='personas' AND column_name='foto_ruta_segura');
SET @ddl=IF(@n=0,'ALTER TABLE personas ADD COLUMN foto_ruta_segura VARCHAR(500) NULL, ADD COLUMN foto_hash_sha256 CHAR(64) NULL, ADD COLUMN foto_mime VARCHAR(40) NULL','SELECT 1'); PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='intentos_ingreso' AND column_name='tiene_golpe');
SET @ddl=IF(@n=0,'ALTER TABLE intentos_ingreso ADD COLUMN tiene_golpe BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN tiene_herida BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN lleva_medicamentos BOOLEAN NOT NULL DEFAULT FALSE','SELECT 1'); PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='atenciones_enfermeria' AND column_name='tipo_incidente');
SET @ddl=IF(@n=0,'ALTER TABLE atenciones_enfermeria ADD COLUMN tipo_incidente VARCHAR(80) NULL, ADD COLUMN observaciones TEXT NULL','SELECT 1'); PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='administraciones_medicamento' AND column_name='resultado');
SET @ddl=IF(@n=0,'ALTER TABLE administraciones_medicamento ADD COLUMN resultado ENUM(''ADMINISTRADA'',''NO_QUISO'',''RECHAZO'',''VOMITO'',''NO_FUE_POSIBLE'',''OTRO'') NULL, ADD COLUMN motivo_resultado TEXT NULL','SELECT 1'); PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='ingredientes_comedor' AND column_name='sinonimos');
SET @ddl=IF(@n=0,'ALTER TABLE ingredientes_comedor ADD COLUMN sinonimos JSON NULL','SELECT 1'); PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='platillos_comedor' AND column_name='descripcion');
SET @ddl=IF(@n=0,'ALTER TABLE platillos_comedor ADD COLUMN descripcion TEXT NULL, ADD COLUMN fecha_menu DATE NULL, ADD COLUMN tipo_comida ENUM(''DESAYUNO'',''COLACION'',''COMIDA'',''MERIENDA'') NULL, ADD INDEX ix_platillos_menu (fecha_menu,tipo_comida)','SELECT 1'); PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='restricciones_alimentarias' AND column_name='categoria_alergia');
SET @ddl=IF(@n=0,'ALTER TABLE restricciones_alimentarias ADD COLUMN categoria_alergia ENUM(''ALIMENTARIA'',''MEDICAMENTO'',''OTRA'') NOT NULL DEFAULT ''ALIMENTARIA''','SELECT 1'); PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
GRANT UPDATE ON guarderia.platillos_comedor TO 'guarderia_app'@'%';
INSERT INTO auditoria_eventos(id_usuario,entidad,entidad_id,accion,detalle)
SELECT NULL,'migraciones',14,'APLICAR',JSON_OBJECT('archivo','014_operacion_integrada.sql')
WHERE NOT EXISTS(SELECT 1 FROM auditoria_eventos WHERE entidad='migraciones' AND entidad_id=14 AND accion='APLICAR');
