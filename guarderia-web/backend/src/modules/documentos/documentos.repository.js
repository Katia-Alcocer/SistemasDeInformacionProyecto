export async function insert(db,child,type,file,purpose='EXPEDIENTE'){const [r]=await db.execute('INSERT INTO documentos_menor(id_menor,tipo,ruta_segura,hash_sha256,uso) VALUES (?,?,?,?,?)',[child,type,file.name,file.hash,purpose]);return r.insertId;}
export async function find(db,child,id){const [r]=await db.execute('SELECT * FROM documentos_menor WHERE id_menor=? AND id_documento=? FOR UPDATE',[child,id]);return r[0];}
export async function review(db,id,actor,valid){await db.execute('UPDATE documentos_menor SET validado=?,validado_por=? WHERE id_documento=?',[valid,actor,id]);}
export async function person(db,id){const [r]=await db.execute('SELECT id_persona,identificacion_ruta_segura FROM personas WHERE id_persona=? FOR UPDATE',[id]);return r[0];}
export async function identity(db,id,file){await db.execute('UPDATE personas SET identificacion_ruta_segura=? WHERE id_persona=?',[file.name,id]);}
export async function invalidateCivil(db,id){await db.execute('UPDATE menores SET registro_civil_validado=0 WHERE id_menor=?',[id]);}
