import {describe,test,beforeAll,afterAll,expect} from 'vitest';
import request from 'supertest';
import {randomBytes,randomUUID} from 'node:crypto';
import {createDatabase} from '../src/config/database.js';
import {createApp} from '../src/app.js';
import {usuariosService} from '../src/modules/usuarios/usuarios.service.js';
import {userSchema} from '../src/modules/usuarios/usuarios.validation.js';
import {civilDate} from '../src/utils/transaction.js';
import {addMonths} from '../src/utils/dates.js';
describe.skipIf(process.env.RUN_DB_TESTS!=='true')('S5 enfermería, mediciones y urgencia con MySQL real',()=>{
 let db,app,admin,nurse,clerk,teacher,as,ns,cs,ts,seq=0;const suffix=randomBytes(4).toString('hex'),password=randomBytes(18).toString('hex'),today=civilDate();let instant=`${today}T16:00:00Z`;
 const config={secret:'s5-nursing-private-test-secret-at-least-32',secure:false,origin:'http://localhost:5173',clock:()=>new Date(instant)};
 const call=(s,method,path,body,key)=>{const r=request(app)[method](`/api/v1${path}`).set('Cookie',s.cookie).set('X-CSRF-Token',s.csrf);if(key)r.set('Idempotency-Key',key);return body?r.send(body):r;};
 async function login(u){const r=await request(app).post('/api/v1/auth/login').send({email:u.email,password});expect(r.status).toBe(200);return {cookie:r.headers['set-cookie'][0].split(';')[0],csrf:r.body.data.csrfToken};}
 async function fixture(present=true){const [m]=await db.execute("INSERT INTO menores(codigo,nombres,apellido_paterno,fecha_nacimiento,estatus) VALUES (?,'Ficticio','Enfermería',?,'ACTIVO')",[`N5-${suffix}-${++seq}`,addMonths(today,-14)]);let attendance=null;
  if(present){const [i]=await db.execute("INSERT INTO intentos_ingreso(id_menor,id_usuario,intento_at,resultado) VALUES (?,?,?,'ACEPTADO')",[m.insertId,admin.id_usuario,`${today} 14:15:00`]);const [a]=await db.execute('INSERT INTO asistencias(id_menor,id_intento,fecha,ingreso_at) VALUES (?,?,?,?)',[m.insertId,i.insertId,today,`${today} 14:15:00`]);attendance=a.insertId;}
  const [p]=await db.execute("INSERT INTO personas(nombre) VALUES ('Familiar ficticio')");const [v]=await db.execute("INSERT INTO menor_persona(id_menor,id_persona,tipo,parentesco,fecha_inicio) VALUES (?,?,'PRINCIPAL','Familiar',?)",[m.insertId,p.insertId,today]);return {id:m.insertId,attendance,link:v.insertId};
 }
 const care=(c,extra={},key=randomUUID(),s=ns)=>call(s,'post','/enfermeria/atenciones',{id_menor:c.id,id_asistencia:c.attendance,motivo:'Incidente ficticio documentado',acciones:'Acciones ficticias de prueba',requiere_recoleccion:false,confirmacion:true,...extra},key);
 const measure=(c,extra={},key=randomUUID(),s=ns)=>call(s,'post','/enfermeria/mediciones',{id_menor:c.id,tipo:'MENSUAL',id_atencion:null,peso_kg:10.125,talla_cm:75.25,confirmacion_medicion:true,...extra},key);
 const exit=(c,alert=null,extra={})=>call(cs,'post','/recepcion/salida',{id_asistencia:c.attendance,id_vinculo:c.link,id_alerta_recoleccion:alert,identidad_verificada:true,metodo_verificacion:'CHECK',confirmacion:true,observaciones:'Cotejo de urgencia ficticia',...extra},randomUUID());
 beforeAll(async()=>{if(process.env.DB_HOST!=='mysql-test')throw new Error('Fixtures solo mysql-test');db=createDatabase();app=createApp(db,config);const create=(rol,label)=>usuariosService(db).create(userSchema.parse({nombre:`Ficticio N5 ${label}`,email:`n5-${label}-${suffix}@example.test`,password,rol}),null);admin=await create('ADMIN','admin');nurse=await create('ENFERMERIA','nurse');clerk=await create('RECEPCION','clerk');teacher=await create('EDUCADORA','teacher');as=await login(admin);ns=await login(nurse);cs=await login(clerk);ts=await login(teacher);});
 afterAll(async()=>{await db?.end();});
 test('atención/alerta idempotentes conservan actor y hora sin confiar en cliente',async()=>{
  const c=await fixture(),key=randomUUID();const results=await Promise.all([care(c,{requiere_recoleccion:true},key),care(c,{requiere_recoleccion:true},key)]);expect(results.map(r=>r.status)).toEqual([201,201]);expect(results[0].body.data.id_atencion).toBe(results[1].body.data.id_atencion);expect(results[0].body.data.id_alerta).toBe(results[1].body.data.id_alerta);
  const [rows]=await db.execute('SELECT n.id_usuario,n.atendido_at,COUNT(a.id_alerta) alerts FROM atenciones_enfermeria n LEFT JOIN alertas_recoleccion a USING(id_atencion) WHERE n.id_atencion=? GROUP BY n.id_usuario,n.atendido_at',[results[0].body.data.id_atencion]);expect(rows[0]).toEqual({id_usuario:nurse.id_usuario,atendido_at:`${today} 16:00:00`,alerts:1});expect((await care(c,{requiere_recoleccion:true,motivo:'Otro contenido'},key)).status).toBe(409);
 });
 test('asistencia ajena y ausencia no habilitan urgencia; atención sin asistencia sí se registra',async()=>{
  const c=await fixture(),other=await fixture(),absent=await fixture(false);expect((await care(c,{id_asistencia:other.attendance})).status).toBe(422);expect((await care(absent,{requiere_recoleccion:true})).status).toBe(422);expect((await care(absent)).status).toBe(201);
 });
 test('una medición mensual ante concurrencia; reintento exacto y cobertura pendientes',async()=>{
  const c=await fixture(false);let coverage=await call(ns,'get','/enfermeria/cobertura');expect(coverage.body.data.menores.find(m=>m.id_menor===c.id).id_medicion).toBeNull();expect(coverage.body.data.poblacion).toBe('ACTIVOS_ACTUALES');
  const r=await Promise.all([measure(c),measure(c)]);expect(r.map(x=>x.status).sort()).toEqual([201,409]);coverage=await call(ns,'get','/enfermeria/cobertura');expect(coverage.body.data.menores.find(m=>m.id_menor===c.id)).toMatchObject({peso_kg:'10.125',talla_cm:'75.25'});
  const d=await fixture(false),key=randomUUID();expect((await measure(d,{},key)).status).toBe(201);expect((await measure(d,{},key)).body.data.repetido).toBe(true);expect((await measure(d,{peso_kg:11},key)).status).toBe(409);
 });
 test('medición por incidente exige atención del menor y de hoy; no sustituye mensual',async()=>{
  const c=await fixture(),other=await fixture(),r=await care(c),id=r.body.data.id_atencion;expect((await measure(other,{tipo:'INCIDENTE',id_atencion:id})).status).toBe(422);
  for(let i=0;i<2;i++)expect((await measure(c,{tipo:'INCIDENTE',id_atencion:id})).status).toBe(201);
  const coverage=await call(ns,'get','/enfermeria/cobertura');expect(coverage.body.data.menores.find(m=>m.id_menor===c.id).id_medicion).toBeNull();await db.execute('UPDATE atenciones_enfermeria SET atendido_at=DATE_SUB(atendido_at,INTERVAL 1 DAY) WHERE id_atencion=?',[id]);expect((await measure(c,{tipo:'INCIDENTE',id_atencion:id})).status).toBe(422);
 });
 test('salida urgente exige alerta propia abierta, conserva autorización y cierra alertas al entregar',async()=>{
  const c=await fixture(),other=await fixture();expect((await exit(c)).body.error.code).toBe('TOO_EARLY');const alert=(await care(c,{requiere_recoleccion:true})).body.data.id_alerta,foreign=(await care(other,{requiere_recoleccion:true})).body.data.id_alerta;
  expect((await exit(c,foreign)).body.error.code).toBe('INVALID_PICKUP_ALERT');expect((await exit(c,alert,{id_vinculo:other.link})).body.error.code).toBe('UNAUTHORIZED_PERSON');
  const detail=await call(cs,'get',`/recepcion/salidas/${c.attendance}`);expect(detail.body.data.recolecciones.some(a=>a.id_alerta===alert)).toBe(true);expect((await exit(c,alert)).status).toBe(201);
  const [rows]=await db.execute('SELECT estado,resuelta_at,motivo_cierre FROM alertas_recoleccion WHERE id_alerta=?',[alert]);expect(rows[0]).toEqual({estado:'CERRADO',resuelta_at:`${today} 16:00:00`,motivo_cierre:'ENTREGA_REGISTRADA'});expect((await care(c,{requiere_recoleccion:true})).status).toBe(422);
 });
 test('contacto manual no cierra ni entrega; cancelación retira la excepción horaria',async()=>{
  const c=await fixture(),alert=(await care(c,{requiere_recoleccion:true})).body.data.id_alerta;const path=`/enfermeria/recolecciones/${alert}`;
  const contact=await call(cs,'patch',path+'/contacto',{confirmacion:true,detalle:'Contacto ficticio realizado'});expect(contact.status).toBe(200);const [rows]=await db.execute('SELECT estado,contactado_por FROM alertas_recoleccion WHERE id_alerta=?',[alert]);expect(rows[0]).toEqual({estado:'CONTACTADO',contactado_por:clerk.id_usuario});
  expect((await call(cs,'patch',path+'/cierre',{confirmacion:true,motivo:'No autorizado'})).status).toBe(403);expect((await call(ns,'patch',path+'/cierre',{confirmacion:true,motivo:'Solicitud retirada tras revisión'})).status).toBe(200);expect((await exit(c,alert)).body.error.code).toBe('INVALID_PICKUP_ALERT');
 });
 test('rangos, precisión, periodo servidor, mensual activa y permisos protegen historia clínica',async()=>{
  const c=await fixture(false);for(const extra of [{peso_kg:0},{peso_kg:1000},{peso_kg:1.2345},{talla_cm:0},{talla_cm:1.234},{periodo_mensual:'2020-01-01'},{confirmacion_medicion:false}])expect((await measure(c,extra)).status).toBe(400);
  await db.execute("UPDATE menores SET estatus='BAJA' WHERE id_menor=?",[c.id]);expect((await measure(c)).status).toBe(422);
  for(const s of [cs,ts]){expect((await measure(c,{},randomUUID(),s)).status).toBe(403);expect((await call(s,'get',`/enfermeria/menores/${c.id}`)).status).toBe(403);}expect((await call(ts,'get','/enfermeria/recolecciones')).status).toBe(403);expect((await call(cs,'get','/enfermeria/recolecciones')).status).toBe(200);
  expect((await call(ns,'get','/enfermeria/cobertura?mes=2099-01')).status).toBe(400);expect((await call(ns,'get','/enfermeria/cobertura?mes=2026-13')).status).toBe(400);
 });
 test('payload clínico estricto, clave y CSRF; historial no expone hashes de operación',async()=>{
  const c=await fixture();expect((await care(c,{atendido_at:'2000-01-01'})).status).toBe(400);expect((await care(c,{id_usuario:admin.id_usuario})).status).toBe(400);expect((await call(ns,'post','/enfermeria/atenciones',{id_menor:c.id,motivo:'Prueba',acciones:'Prueba',requiere_recoleccion:false,confirmacion:true})).status).toBe(400);
  const r=await care(c);expect(r.status).toBe(201);const read=await call(ns,'get',`/enfermeria/menores/${c.id}`);expect(read.status).toBe(200);expect(read.text).not.toContain('solicitud_hash');const noCsrf=await request(app).post('/api/v1/enfermeria/mediciones').set('Cookie',ns.cookie).send({});expect(noCsrf.status).toBe(403);
 });
});
