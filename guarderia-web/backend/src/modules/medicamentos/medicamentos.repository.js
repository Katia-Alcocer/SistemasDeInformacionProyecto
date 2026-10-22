const selection=`SELECT a.id_administracion,a.id_horario,a.fecha_programada,a.estado,a.aplicada_at,a.resuelta_at,a.id_usuario,a.dosis_aplicada,a.observaciones,
 h.hora,t.id_tratamiento,t.medicamento,t.dosis,t.unidad,t.via,t.fecha_inicio,t.fecha_fin,t.dosificador_requerido,t.dosificador_entregado,t.indicaciones,t.suspendido,
 r.id_receta,r.id_menor,r.vigencia_inicio,r.vigencia_fin,r.verificada_por,r.verificada_at,r.permite_convivencia,
 m.nombres,m.apellido_paterno,m.estatus,d.ruta_segura,d.hash_sha256,d.validado documento_validado
 FROM administraciones_medicamento a JOIN horarios_tratamiento h USING(id_horario) JOIN tratamientos t USING(id_tratamiento) JOIN recetas r USING(id_receta) JOIN menores m USING(id_menor)
 LEFT JOIN documentos_menor d ON r.ruta_documento=CONCAT('documento:',d.id_documento) AND d.id_menor=r.id_menor AND d.uso='MEDICO'`;
export async function schedule(db,date){
  // La restricción única (horario, fecha) y el bloqueo operativo impiden duplicados.
  const [rows]=await db.execute(`SELECT h.id_horario FROM horarios_tratamiento h JOIN tratamientos t USING(id_tratamiento) JOIN recetas r USING(id_receta) JOIN menores m USING(id_menor)
    JOIN documentos_menor d ON r.ruta_documento=CONCAT('documento:',d.id_documento) AND d.id_menor=r.id_menor AND d.uso='MEDICO' AND d.validado=1
    WHERE m.estatus='ACTIVO' AND t.suspendido=0 AND r.verificada_por IS NOT NULL AND r.verificada_at IS NOT NULL AND r.permite_convivencia=1
    AND r.vigencia_inicio<=? AND r.vigencia_fin>=? AND t.fecha_inicio<=? AND t.fecha_fin>=?
    AND EXISTS (SELECT 1 FROM asistencias s WHERE s.id_menor=m.id_menor AND s.fecha=? AND NOT EXISTS(SELECT 1 FROM entregas e WHERE e.id_asistencia=s.id_asistencia))
    AND NOT EXISTS(SELECT 1 FROM administraciones_medicamento a WHERE a.id_horario=h.id_horario AND a.fecha_programada=?)`,[date,date,date,date,date,date]);
  for(const row of rows)await db.execute('INSERT INTO administraciones_medicamento(id_horario,fecha_programada) VALUES (?,?)',[row.id_horario,date]);return rows.length;
}
export async function list(db,date,user){const [rows]=await db.execute(`${selection} WHERE (a.fecha_programada=? OR (a.estado='PENDIENTE' AND a.fecha_programada<?)) AND (?<>'EDUCADORA' OR EXISTS(SELECT 1 FROM historial_grupos hg JOIN grupos g USING(id_grupo) JOIN asignaciones_educadoras ae USING(id_grupo) WHERE hg.id_menor=r.id_menor AND g.activo=1 AND hg.fecha_inicio<=? AND (hg.fecha_fin IS NULL OR hg.fecha_fin>?) AND ae.id_usuario=? AND ae.fecha_inicio<=? AND (ae.fecha_fin IS NULL OR ae.fecha_fin>?))) ORDER BY a.fecha_programada DESC,h.hora,a.id_administracion LIMIT 500`,[date,date,user.rol,date,date,user.id_usuario,date,date]);return rows;}
export async function find(db,id){const [rows]=await db.execute(`${selection} WHERE a.id_administracion=? FOR UPDATE`,[id]);return rows[0];}
export async function previous(db,key){const [rows]=await db.execute('SELECT id_administracion,estado,resuelta_at,solicitud_hash FROM administraciones_medicamento WHERE clave_idempotencia=?',[key]);return rows[0];}
export async function resolve(db,id,input,user,clock,key,hash){await db.execute("UPDATE administraciones_medicamento SET estado=?,aplicada_at=?,resuelta_at=?,id_usuario=?,dosis_aplicada=?,observaciones=?,clave_idempotencia=?,solicitud_hash=? WHERE id_administracion=? AND estado='PENDIENTE'",[input.estado,input.estado==='APLICADA'?clock.utc:null,clock.utc,user,input.dosis_aplicada,input.observaciones,key,hash,id]);}
