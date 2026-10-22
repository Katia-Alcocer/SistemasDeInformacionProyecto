export const publicUser = u => ({id_usuario:u.id_usuario,nombre:u.nombre,email:u.email,rol:u.rol,activo:Boolean(u.activo)});
export async function userByEmail(db,email,lock=false) {
  const [rows] = await db.execute(`SELECT u.*,r.codigo rol FROM usuarios u JOIN roles r USING(id_rol) WHERE u.email=?${lock?' FOR UPDATE':''}`,[email]);
  return rows[0];
}
export async function activeSession(db,id,hash) {
  const [rows] = await db.execute(`SELECT u.id_usuario,u.nombre,u.email,u.activo,r.codigo rol FROM sesiones s JOIN usuarios u USING(id_usuario) JOIN roles r USING(id_rol) WHERE s.jti_hash=? AND s.id_usuario=? AND s.revocada_at IS NULL AND s.expira_at>UTC_TIMESTAMP() AND u.activo=1 AND u.deleted_at IS NULL`,[hash,id]);
  return rows[0];
}
export async function addSession(db,id,hash) {
  await db.execute('INSERT INTO sesiones(id_usuario,jti_hash,emitida_at,expira_at) VALUES (?,?,UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 HOUR))',[id,hash]);
}
export async function revokeSession(db,hash) {
  await db.execute('UPDATE sesiones SET revocada_at=UTC_TIMESTAMP() WHERE jti_hash=? AND revocada_at IS NULL',[hash]);
}
