export async function fees(db,child){const [r]=await db.execute(`SELECT c.id_cuota,c.id_menor,c.periodo_inicio,c.periodo_fin,c.vencimiento,c.importe,c.estado,c.created_at,m.codigo,m.nombres,m.apellido_paterno,
 COALESCE((SELECT SUM(p.importe) FROM pagos p WHERE p.id_cuota=c.id_cuota AND p.estado='REGISTRADO'),0) pagado,
 COALESCE((SELECT MAX(nueva_fecha) FROM prorrogas x WHERE x.id_cuota=c.id_cuota),c.vencimiento) prorroga_hasta
 FROM cuotas c JOIN menores m USING(id_menor) ${child?'WHERE c.id_menor=?':''} ORDER BY c.periodo_inicio DESC,c.id_cuota DESC`,child?[child]:[]);return r;}
export async function fee(db,id){const [r]=await db.execute('SELECT c.*,m.codigo,m.nombres,m.apellido_paterno FROM cuotas c JOIN menores m USING(id_menor) WHERE id_cuota=? FOR UPDATE',[id]);return r[0];}
export async function paid(db,id){const [r]=await db.execute("SELECT COALESCE(SUM(importe),0) total FROM pagos WHERE id_cuota=? AND estado='REGISTRADO'",[id]);return r[0].total;}
export async function previous(db,table,key){const [r]=await db.execute(`SELECT * FROM ${table} WHERE clave_idempotencia=?`,[key]);return r[0];}
export async function payments(db,id){const [r]=await db.execute('SELECT id_pago,id_cuota,importe,pagado_at,metodo,referencia,id_usuario,estado,motivo_anulacion,anulado_por,anulado_at FROM pagos WHERE id_cuota=? ORDER BY id_pago DESC',[id]);return r;}
export async function paymentForUpdate(db,id){const [r]=await db.execute('SELECT * FROM pagos WHERE id_pago=? FOR UPDATE',[id]);return r[0];}
export async function cancellationByKey(db,key){const [r]=await db.execute('SELECT id_pago,anulacion_hash,anulacion_respuesta FROM pagos WHERE anulacion_clave_idempotencia=?',[key]);return r[0];}
export async function recordCancellation(db,id,data){return db.execute("UPDATE pagos SET estado='ANULADO',motivo_anulacion=?,anulado_por=?,anulado_at=?,anulacion_clave_idempotencia=?,anulacion_hash=? WHERE id_pago=? AND estado='REGISTRADO'",[data.motivo,data.actor,data.at,data.key,data.hash,id]);}
export async function saveCancellationResult(db,id,response){return db.execute('UPDATE pagos SET anulacion_respuesta=? WHERE id_pago=?',[JSON.stringify(response),id]);}
export async function extensions(db,id){const [r]=await db.execute('SELECT id_prorroga,id_cuota,nueva_fecha,motivo,id_usuario,autorizada_at FROM prorrogas WHERE id_cuota=? ORDER BY nueva_fecha,id_prorroga',[id]);return r;}
