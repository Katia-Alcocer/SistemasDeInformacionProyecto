import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {createDatabase} from '../src/config/database.js';
import {usuariosService} from '../src/modules/usuarios/usuarios.service.js';
import {userSchema} from '../src/modules/usuarios/usuarios.validation.js';
const input=createInterface({input:stdin,output:stdout});
const pool=createDatabase();
try{
  const nombre=process.env.ADMIN_NAME || await input.question('Nombre ADMIN: ');
  const email=process.env.ADMIN_EMAIL || await input.question('Correo ADMIN: ');
  // La contraseña se recibe por entorno, nunca se escribe en logs ni argumentos.
  const password=process.env.ADMIN_PASSWORD;
  if(!password)throw new Error('Suministra ADMIN_PASSWORD mediante entorno privado');
  const [rows]=await pool.query("SELECT COUNT(*) total FROM usuarios u JOIN roles r USING(id_rol) WHERE r.codigo='ADMIN' AND u.activo=1");
  if(rows[0].total>0)throw new Error('Ya existe ADMIN; usa la gestión autenticada de usuarios');
  await usuariosService(pool).create(userSchema.parse({nombre,email,password,rol:'ADMIN'}),null,{bootstrap:true});
  console.info('ADMIN creado; contraseña no registrada.');
}catch{console.error('No se pudo crear ADMIN: revisa datos, contraseña (12–72 bytes) y si ya existe uno.');process.exitCode=1;}
finally{input.close();await pool.end();}
