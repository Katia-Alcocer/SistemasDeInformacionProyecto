-- S1: migración no destructiva. Aplicar una vez por administración.
-- No modifica grupos existentes: revisar los activos sin responsable antes de uso.
ALTER TABLE grupos ALTER COLUMN activo SET DEFAULT FALSE;
INSERT INTO auditoria_eventos(id_usuario,entidad,entidad_id,accion,detalle)
SELECT NULL,'migraciones',1,'APLICAR',JSON_OBJECT('archivo','001_grupos_inactivos.sql')
WHERE NOT EXISTS (SELECT 1 FROM auditoria_eventos WHERE entidad='migraciones' AND entidad_id=1 AND accion='APLICAR');
