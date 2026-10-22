export async function groups(db,user,date){
  const [rows]=await db.execute(`SELECT g.id_grupo,g.codigo,g.nombre FROM grupos g WHERE g.activo=1 AND (?='ADMIN' OR EXISTS (SELECT 1 FROM asignaciones_educadoras a WHERE a.id_grupo=g.id_grupo AND a.id_usuario=? AND a.fecha_inicio<=? AND (a.fecha_fin IS NULL OR a.fecha_fin>?))) ORDER BY g.codigo`,[user.rol,user.id_usuario,date,date]);return rows;
}
export async function children(db,group,date){
  const [rows]=await db.execute(`SELECT DISTINCT m.id_menor,m.codigo,m.nombres,m.apellido_paterno,a.id_asistencia FROM menores m JOIN historial_grupos h USING(id_menor) JOIN asistencias a USING(id_menor) WHERE h.id_grupo=? AND h.fecha_inicio<=? AND (h.fecha_fin IS NULL OR h.fecha_fin>?) AND m.estatus='ACTIVO' AND a.fecha=? AND NOT EXISTS (SELECT 1 FROM entregas e WHERE e.id_asistencia=a.id_asistencia) ORDER BY m.nombres,m.id_menor`,[group,date,date,date]);return rows;
}
export async function presentGroup(db,child,date){
  const [rows]=await db.execute(`SELECT h.id_grupo FROM historial_grupos h JOIN menores m USING(id_menor) JOIN asistencias a USING(id_menor) JOIN grupos g USING(id_grupo) WHERE m.id_menor=? AND m.estatus='ACTIVO' AND g.activo=1 AND h.fecha_inicio<=? AND (h.fecha_fin IS NULL OR h.fecha_fin>?) AND a.fecha=? AND NOT EXISTS (SELECT 1 FROM entregas e WHERE e.id_asistencia=a.id_asistencia)`,[child,date,date,date]);return rows;
}
export async function activities(db,group,date){
  const [rows]=await db.execute('SELECT id_actividad,id_grupo,fecha,titulo,descripcion,id_educadora FROM actividades_aula WHERE id_grupo=? AND fecha=? ORDER BY id_actividad DESC LIMIT 100',[group,date]);
  for(const activity of rows){const [participants]=await db.execute('SELECT p.id_asistencia,p.observaciones,m.id_menor,m.nombres,m.apellido_paterno FROM participaciones_actividad p JOIN asistencias a USING(id_asistencia) JOIN menores m USING(id_menor) WHERE p.id_actividad=? ORDER BY p.id_asistencia',[activity.id_actividad]);activity.participantes=participants;}return rows;
}
export async function previousActivity(db,key){const [rows]=await db.execute('SELECT id_actividad,id_grupo,fecha,solicitud_hash FROM actividades_aula WHERE clave_idempotencia=?',[key]);return rows[0];}
export async function addActivity(db,group,date,input,user,key,hash){
  const [r]=await db.execute('INSERT INTO actividades_aula(id_grupo,fecha,titulo,descripcion,id_educadora,clave_idempotencia,solicitud_hash) VALUES (?,?,?,?,?,?,?)',[group,date,input.titulo,input.descripcion,user,key,hash]);
  for(const p of input.participantes)await db.execute('INSERT INTO participaciones_actividad(id_actividad,id_asistencia,observaciones) VALUES (?,?,?)',[r.insertId,p.id_asistencia,p.observaciones]);return r.insertId;
}
