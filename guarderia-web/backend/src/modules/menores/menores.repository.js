const columns='id_menor,codigo,id_preinscripcion,nombres,apellido_paterno,apellido_materno,fecha_nacimiento,curp,registro_civil_validado,estatus,fecha_alta,motivo_baja,deleted_at';
export async function list(db){const [r]=await db.query(`SELECT ${columns} FROM menores ORDER BY id_menor DESC LIMIT 500`);return r;}
export async function find(db,id,lock=false){const [r]=await db.execute(`SELECT ${columns} FROM menores WHERE id_menor=?${lock?' FOR UPDATE':''}`,[id]);return r[0];}
export async function insert(db,c){const [r]=await db.execute('INSERT INTO menores(codigo,nombres,apellido_paterno,apellido_materno,fecha_nacimiento,curp,id_preinscripcion) VALUES (?,?,?,?,?,?,?)',[c.codigo,c.nombres,c.apellido_paterno,c.apellido_materno,c.fecha_nacimiento,c.curp,c.id_preinscripcion]);return r.insertId;}
export async function update(db,id,c){await db.execute('UPDATE menores SET codigo=?,nombres=?,apellido_paterno=?,apellido_materno=?,fecha_nacimiento=?,curp=? WHERE id_menor=?',[c.codigo,c.nombres,c.apellido_paterno,c.apellido_materno,c.fecha_nacimiento,c.curp,id]);}
export async function history(db,id){const [r]=await db.execute('SELECT h.id_historial,h.id_grupo,g.nombre grupo,g.codigo,h.fecha_inicio,h.fecha_fin,h.motivo FROM historial_grupos h JOIN grupos g USING(id_grupo) WHERE h.id_menor=? ORDER BY h.id_historial',[id]);return r;}
export async function authorizedPeople(db,id){const [r]=await db.execute('SELECT v.id_vinculo,v.tipo,v.parentesco,v.puede_recoger,v.restriccion_judicial,v.respaldo_restriccion IS NOT NULL respaldo_documentado,v.fecha_inicio,v.fecha_fin,p.nombre,p.telefono,p.activo FROM menor_persona v JOIN personas p USING(id_persona) WHERE v.id_menor=? ORDER BY v.id_vinculo',[id]);return r.map(v=>({...v,puede_recoger:Boolean(v.puede_recoger),restriccion_judicial:Boolean(v.restriccion_judicial),respaldo_documentado:Boolean(v.respaldo_documentado),activo:Boolean(v.activo)}));}
export async function badges(db,id){const [r]=await db.execute('SELECT numero,estado,fecha_emision FROM gafetes WHERE id_menor=? ORDER BY numero',[id]);return r;}
export async function documents(db,id){const [r]=await db.execute('SELECT id_documento,tipo,uso,validado,validado_por,registrado_at FROM documentos_menor WHERE id_menor=? ORDER BY id_documento DESC',[id]);return r;}
export async function auditHistory(db,id){
 const [r]=await db.execute(`SELECT e.id_evento,e.id_usuario,e.entidad,e.entidad_id,e.accion,e.detalle,e.creado_at
 FROM auditoria_eventos e
 WHERE (e.entidad='menores' AND e.entidad_id=?)
 OR JSON_UNQUOTE(JSON_EXTRACT(e.detalle,'$.id_menor'))=?
 OR CAST(JSON_UNQUOTE(JSON_EXTRACT(e.detalle,'$.id_asistencia')) AS UNSIGNED) IN (SELECT a.id_asistencia FROM asistencias a WHERE a.id_menor=?)
 OR (e.entidad='asistencias' AND e.entidad_id IN (SELECT a.id_asistencia FROM asistencias a WHERE a.id_menor=?))
 OR (e.entidad='atenciones_enfermeria' AND e.entidad_id IN (SELECT n.id_atencion FROM atenciones_enfermeria n WHERE n.id_menor=?))
 OR (e.entidad='alertas_recoleccion' AND e.entidad_id IN (SELECT x.id_alerta FROM alertas_recoleccion x JOIN atenciones_enfermeria n USING(id_atencion) WHERE n.id_menor=?))
 OR (e.entidad='retardos' AND e.entidad_id IN (SELECT r.id_retardo FROM retardos r JOIN asistencias a USING(id_asistencia) WHERE a.id_menor=?))
 OR (e.entidad='cuotas' AND e.entidad_id IN (SELECT c.id_cuota FROM cuotas c WHERE c.id_menor=?))
 OR (e.entidad='pagos' AND e.entidad_id IN (SELECT p.id_pago FROM pagos p JOIN cuotas c USING(id_cuota) WHERE c.id_menor=?))
 OR (e.entidad='prorrogas' AND e.entidad_id IN (SELECT p.id_prorroga FROM prorrogas p JOIN cuotas c USING(id_cuota) WHERE c.id_menor=?))
 OR (e.entidad='preinscripciones' AND e.entidad_id IN (SELECT id_preinscripcion FROM menores WHERE id_menor=? AND id_preinscripcion IS NOT NULL))
 OR (e.entidad='personas' AND e.entidad_id IN (SELECT id_persona FROM menor_persona WHERE id_menor=?))
 OR (e.entidad='tratamientos' AND e.entidad_id IN (SELECT t.id_tratamiento FROM tratamientos t JOIN recetas r USING(id_receta) WHERE r.id_menor=?))
 OR (e.entidad='restricciones_alimentarias' AND e.entidad_id IN (SELECT id_restriccion FROM restricciones_alimentarias WHERE id_menor=?))
 ORDER BY e.creado_at,e.id_evento`,[id,String(id),id,id,id,id,id,id,id,id,id,id,id,id]);
 return r;
}
export async function preinscription(db,id){const [r]=await db.execute('SELECT * FROM preinscripciones WHERE id_preinscripcion=? FOR UPDATE',[id]);return r[0];}
export async function preinscriptionLinked(db,id){const [r]=await db.execute('SELECT id_menor FROM menores WHERE id_preinscripcion=?',[id]);return r.length>0;}
export async function markCivil(db,id){await db.execute('UPDATE menores SET registro_civil_validado=1 WHERE id_menor=?',[id]);}
export async function invalidateCivil(db,id){await db.execute('UPDATE menores SET registro_civil_validado=0 WHERE id_menor=?',[id]);}
export async function group(db,id,today){const [r]=await db.execute(`SELECT g.*,c.codigo categoria FROM grupos g JOIN categorias_edad c USING(id_categoria) WHERE g.id_grupo=? AND g.activo=1 AND EXISTS (SELECT 1 FROM asignaciones_educadoras a JOIN usuarios u USING(id_usuario) JOIN roles r USING(id_rol) WHERE a.id_grupo=g.id_grupo AND a.responsable=1 AND a.fecha_inicio<=? AND (a.fecha_fin IS NULL OR a.fecha_fin>?) AND u.activo=1 AND u.deleted_at IS NULL AND r.codigo='EDUCADORA') FOR UPDATE`,[id,today,today]);return r[0];}
export async function occupancy(db,id,today){const [r]=await db.execute("SELECT COUNT(*) total FROM historial_grupos h JOIN menores m USING(id_menor) WHERE h.id_grupo=? AND h.fecha_inicio<=? AND (h.fecha_fin IS NULL OR h.fecha_fin>?) AND m.estatus='ACTIVO'",[id,today,today]);return r[0].total;}
export async function currentGroup(db,id,today){const [r]=await db.execute('SELECT * FROM historial_grupos WHERE id_menor=? AND fecha_inicio<=? AND (fecha_fin IS NULL OR fecha_fin>?) FOR UPDATE',[id,today,today]);return r;}
export async function assign(db,id,group,today){await db.execute('UPDATE historial_grupos SET fecha_fin=? WHERE id_menor=? AND (fecha_fin IS NULL OR fecha_fin>?)',[today,id,today]);await db.execute('INSERT INTO historial_grupos(id_menor,id_grupo,fecha_inicio,motivo) VALUES (?,?,?,?)',[id,group,today,'Asignación validada en expediente']);await db.execute("UPDATE menores SET estatus='ACTIVO',fecha_alta=COALESCE(fecha_alta,?),deleted_at=NULL,motivo_baja=NULL WHERE id_menor=?",[today,id]);}
export async function status(db,id,status,reason,today){await db.execute('UPDATE historial_grupos SET fecha_fin=? WHERE id_menor=? AND (fecha_fin IS NULL OR fecha_fin>?)',[today,id,today]);await db.execute('UPDATE menores SET estatus=?,motivo_baja=?,deleted_at=IF(? IN (\'BAJA\',\'EXPULSADO\'),UTC_TIMESTAMP(),NULL) WHERE id_menor=?',[status,reason,status,id]);}
