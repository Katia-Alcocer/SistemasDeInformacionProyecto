export async function list(db) {
  const [rows]=await db.query('SELECT u.id_usuario,u.nombre,u.email,u.activo,r.codigo rol FROM usuarios u JOIN roles r USING(id_rol) ORDER BY u.id_usuario');return rows;
}
export async function find(db,id) {
  const [rows]=await db.execute('SELECT u.*,r.codigo rol FROM usuarios u JOIN roles r USING(id_rol) WHERE id_usuario=? FOR UPDATE',[id]);return rows[0];
}
export async function roleId(db,code) {const [rows]=await db.execute('SELECT id_rol FROM roles WHERE codigo=?',[code]);return rows[0]?.id_rol;}
export async function insert(db,u,hash) {
  const [result]=await db.execute('INSERT INTO usuarios(id_rol,nombre,email,password_hash,activo) VALUES (?,?,?,?,?)',[await roleId(db,u.rol),u.nombre,u.email,hash,u.activo]);return result.insertId;
}
export async function update(db,id,u,hash) {
  await db.execute('UPDATE usuarios SET id_rol=?,nombre=?,email=?,password_hash=?,activo=?,deleted_at=IF(?=1,NULL,COALESCE(deleted_at,UTC_TIMESTAMP())) WHERE id_usuario=?',[await roleId(db,u.rol),u.nombre,u.email,hash,u.activo,u.activo,id]);
  await db.execute('UPDATE sesiones SET revocada_at=UTC_TIMESTAMP() WHERE id_usuario=? AND revocada_at IS NULL',[id]);
}
export async function adminCount(db) {const [rows]=await db.query("SELECT COUNT(*) total FROM usuarios u JOIN roles r USING(id_rol) WHERE r.codigo='ADMIN' AND u.activo=1 AND u.deleted_at IS NULL");return rows[0].total;}
export async function isResponsible(db,id,today) {const [rows]=await db.execute('SELECT id_asignacion FROM asignaciones_educadoras WHERE id_usuario=? AND responsable=1 AND fecha_inicio<=? AND (fecha_fin IS NULL OR fecha_fin>?) LIMIT 1',[id,today,today]);return rows.length>0;}
