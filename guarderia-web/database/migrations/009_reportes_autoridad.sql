-- Conserva una instantánea del hecho generado, sin simular archivo o envío externo.
SET @n=(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='reportes_autoridad' AND column_name='contenido');
SET @ddl=IF(@n=0,'ALTER TABLE reportes_autoridad ADD COLUMN contenido JSON NULL','SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
INSERT INTO auditoria_eventos(id_usuario,entidad,entidad_id,accion,detalle)
SELECT NULL,'migraciones',9,'APLICAR',JSON_OBJECT('archivo','009_reportes_autoridad.sql') WHERE NOT EXISTS(SELECT 1 FROM auditoria_eventos WHERE entidad='migraciones' AND entidad_id=9 AND accion='APLICAR');
