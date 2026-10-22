export async function transaction(pool, operation) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await operation(connection);
    await connection.commit(); return result;
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
// Serializa cambios de usuarios/grupos para mantener último ADMIN y responsables.
export async function lockAdministration(connection) {
  await connection.query('SELECT id_config FROM configuracion_operativa WHERE id_config=1 FOR UPDATE');
}
export async function audit(connection, actor, entity, id, action, detail = {}) {
  await connection.execute('INSERT INTO auditoria_eventos(id_usuario,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)', [actor,entity,id,action,JSON.stringify(detail)]);
}
export function civilDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
