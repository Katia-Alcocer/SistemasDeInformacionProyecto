-- Registro prenatal: nombre tentativo opcional y correo de contacto reutilizable en personas.
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='preinscripciones' AND column_name='posible_nombre_bebe');
SET @ddl=IF(@n=0,'ALTER TABLE preinscripciones ADD COLUMN posible_nombre_bebe VARCHAR(160) NULL AFTER fecha_probable_parto','SELECT 1'); PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='personas' AND column_name='email');
SET @ddl=IF(@n=0,'ALTER TABLE personas ADD COLUMN email VARCHAR(190) NULL AFTER telefono','SELECT 1'); PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
INSERT INTO auditoria_eventos(id_usuario,entidad,entidad_id,accion,detalle)
SELECT NULL,'migraciones',13,'APLICAR',JSON_OBJECT('archivo','013_preinscripcion_materno.sql') WHERE NOT EXISTS(SELECT 1 FROM auditoria_eventos WHERE entidad='migraciones' AND entidad_id=13 AND accion='APLICAR');
