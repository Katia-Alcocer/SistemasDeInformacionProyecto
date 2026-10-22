import {describe,test,beforeAll,afterAll,expect} from 'vitest';
import request from 'supertest';
import {randomBytes,randomUUID} from 'node:crypto';
import {createDatabase} from '../src/config/database.js';
import {createApp} from '../src/app.js';
import {usuariosService} from '../src/modules/usuarios/usuarios.service.js';
import {userSchema} from '../src/modules/usuarios/usuarios.validation.js';
import {gruposService} from '../src/modules/grupos/grupos.service.js';
import {civilDate} from '../src/utils/transaction.js';
import {addMonths} from '../src/utils/dates.js';
describe.skipIf(process.env.RUN_DB_TESTS!=='true')('S5 salida segura con MySQL real',()=>{
 let db,app,admin,clerk,teacher,nurse,group,as,cs,ts,ns,seq=0;
 const suffix=randomBytes(4).toString('hex'),password=randomBytes(18).toString('hex'),today=civilDate();let instant=`${today}T21:30:00Z`;
 const config={secret:'s5-exit-private-test-secret-at-least-32',secure:false,origin:'http://localhost:5173',clock:()=>new Date(instant)};
 const call=(s,method,path,body,key)=>{const r=request(app)[method](`/api/v1${path}`).set('Cookie',s.cookie).set('X-CSRF-Token',s.csrf);if(key)r.set('Idempotency-Key',key);return body?r.send(body):r;};
 async function login(u){const r=await request(app).post('/api/v1/auth/login').send({email:u.email,password});expect(r.status).toBe(200);return {cookie:r.headers['set-cookie'][0].split(';')[0],csrf:r.body.data.csrfToken};}
 async function fixture(){
   const [m]=await db.execute("INSERT INTO menores(codigo,nombres,apellido_paterno,fecha_nacimiento,estatus) VALUES (?,'Ficticio','Salida',?,'ACTIVO')",[`S5-${suffix}-${++seq}`,addMonths(today,-14)]);
   await db.execute('INSERT INTO historial_grupos(id_menor,id_grupo,fecha_inicio) VALUES (?,?,?)',[m.insertId,group.id_grupo,today]);const [i]=await db.execute("INSERT INTO intentos_ingreso(id_menor,id_usuario,intento_at,resultado) VALUES (?,?,?,'ACEPTADO')",[m.insertId,admin.id_usuario,`${today} 14:15:00`]);const [a]=await db.execute('INSERT INTO asistencias(id_menor,id_intento,fecha,ingreso_at) VALUES (?,?,?,?)',[m.insertId,i.insertId,today,`${today} 14:15:00`]);
   const [p]=await db.execute("INSERT INTO personas(nombre) VALUES ('Persona ficticia autorizada')");const [v]=await db.execute("INSERT INTO menor_persona(id_menor,id_persona,tipo,parentesco,fecha_inicio) VALUES (?,?,'PRINCIPAL','Familiar',?)",[m.insertId,p.insertId,today]);return {child:m.insertId,attendance:a.insertId,person:p.insertId,link:v.insertId};
 }
 const payload=(c,extra={})=>({id_asistencia:c.attendance,id_vinculo:c.link,codigo_gafete:null,identidad_verificada:true,metodo_verificacion:'DOCUMENTO',confirmacion:true,observaciones:'Cotejo y entrega ficticios',...extra});
 const exit=(c,extra={},key=randomUUID(),s=cs)=>call(s,'post','/recepcion/salida',payload(c,extra),key);
 async function badge(c){const r=await call(as,'post',`/menores/${c.child}/gafetes`,{});expect(r.status).toBe(201);return r.body.data;}
 beforeAll(async()=>{
   if(process.env.DB_HOST!=='mysql-test')throw new Error('Fixtures solo mysql-test');db=createDatabase();app=createApp(db,config);const create=(rol,label)=>usuariosService(db).create(userSchema.parse({nombre:`Ficticio S5 ${label}`,email:`s5-${label}-${suffix}@example.test`,password,rol}),null);
   admin=await create('ADMIN','admin');clerk=await create('RECEPCION','clerk');teacher=await create('EDUCADORA','teacher');nurse=await create('ENFERMERIA','nurse');group=await gruposService(db).create({codigo:`S5-${suffix}`,nombre:'Grupo ficticio salidas',id_categoria:2,capacidad:100,activo:true,id_responsable:teacher.id_usuario},admin.id_usuario);
   as=await login(admin);cs=await login(clerk);ts=await login(teacher);ns=await login(nurse);
 });
 afterAll(async()=>{await db?.end();});
 test.each([['20:59:00',422,false],['21:00:00',201,false],['21:30:00',201,false],['21:59:59',201,false],['22:00:00',201,true],['22:01:00',201,true]])('UTC %s: ventana servidor y hora cliente ignorada',async(time,status,late)=>{
   const c=await fixture();instant=`${today}T${time}Z`;const r=await exit(c,{hora_salida:'15:30:00'});expect(r.status).toBe(status);
   if(status===201){expect(r.body.data.tardia).toBe(late);const [rows]=await db.execute('SELECT entregado_at,id_usuario FROM entregas WHERE id_asistencia=?',[c.attendance]);expect(rows[0]).toEqual({entregado_at:`${today} ${time}`,id_usuario:clerk.id_usuario});const [delays]=await db.execute('SELECT estado FROM retardos WHERE id_asistencia=?',[c.attendance]);expect(delays).toHaveLength(late?1:0);if(late)expect(delays[0].estado).toBe('PENDIENTE');}
   else {const [audit]=await db.execute("SELECT COUNT(*) n FROM auditoria_eventos WHERE entidad='asistencias' AND entidad_id=? AND accion='RECHAZAR_SALIDA'",[c.attendance]);expect(audit[0].n).toBe(1);}
   instant=`${today}T21:30:00Z`;
 });
 test('vínculo ajeno/cerrado, persona inactiva y restricción judicial se rechazan',async()=>{
   const c=await fixture(),other=await fixture();expect((await exit(c,{id_vinculo:other.link})).body.error.code).toBe('UNAUTHORIZED_PERSON');
   await db.execute('UPDATE menor_persona SET fecha_fin=? WHERE id_vinculo=?',[today,c.link]);expect((await exit(c)).status).toBe(422);await db.execute('UPDATE menor_persona SET fecha_fin=NULL WHERE id_vinculo=?',[c.link]);await db.execute('UPDATE personas SET activo=0 WHERE id_persona=?',[c.person]);expect((await exit(c)).status).toBe(422);await db.execute('UPDATE personas SET activo=1 WHERE id_persona=?',[c.person]);
   await db.execute('UPDATE menor_persona SET puede_recoger=0 WHERE id_vinculo=?',[c.link]);expect((await exit(c)).body.error.code).toBe('UNAUTHORIZED_PERSON');await db.execute('UPDATE menor_persona SET puede_recoger=1,fecha_inicio=DATE_ADD(?,INTERVAL 1 DAY) WHERE id_vinculo=?',[today,c.link]);expect((await exit(c)).body.error.code).toBe('UNAUTHORIZED_PERSON');await db.execute('UPDATE menor_persona SET fecha_inicio=?,restriccion_judicial=1,puede_recoger=0 WHERE id_vinculo=?',[today,c.link]);expect((await exit(c)).body.error.code).toBe('JUDICIAL_RESTRICTION');
   await db.execute('UPDATE menor_persona SET restriccion_judicial=0,puede_recoger=1 WHERE id_vinculo=?',[c.link]);await db.execute("INSERT INTO menor_persona(id_menor,id_persona,tipo,parentesco,fecha_inicio,restriccion_judicial,puede_recoger) VALUES (?,?,'AUXILIAR','Respaldo de prueba',?,1,0)",[c.child,c.person,today]);expect((await exit(c)).body.error.code).toBe('JUDICIAL_RESTRICTION');
 });
 test('gafete válido complementario; ajeno, revocado o extraviado no autorizan',async()=>{
   const c=await fixture(),other=await fixture(),own=await badge(c),foreign=await badge(other);expect((await exit(c,{codigo_gafete:foreign.codigo})).body.error.code).toBe('INVALID_BADGE');
   for(const estado of ['REVOCADO','EXTRAVIADO']){await db.execute('UPDATE gafetes SET estado=? WHERE id_gafete=?',[estado,own.id_gafete]);expect((await exit(c,{codigo_gafete:own.codigo})).body.error.code).toBe('INVALID_BADGE');}
   await db.execute("UPDATE gafetes SET estado='ACTIVO' WHERE id_gafete=?",[own.id_gafete]);const r=await exit(c,{codigo_gafete:own.codigo.toUpperCase()});expect(r.status).toBe(201);const [rows]=await db.execute('SELECT id_gafete,nombre_portador_gafete FROM entregas WHERE id_entrega=?',[r.body.data.id_entrega]);expect(rows[0]).toEqual({id_gafete:own.id_gafete,nombre_portador_gafete:'Persona ficticia autorizada'});const [audit]=await db.execute("SELECT detalle FROM auditoria_eventos WHERE entidad='entregas' AND entidad_id=?",[r.body.data.id_entrega]);expect(JSON.stringify(audit)).not.toContain(own.codigo);
 });
 test('concurrencia e idempotencia: una entrega; clave con otros datos da 409',async()=>{
   const c=await fixture();const results=await Promise.all([exit(c),exit(c)]);expect(results.map(r=>r.status).sort()).toEqual([201,422]);const [rows]=await db.execute('SELECT COUNT(*) n FROM entregas WHERE id_asistencia=?',[c.attendance]);expect(rows[0].n).toBe(1);
   const d=await fixture(),key=randomUUID();const first=await exit(d,{},key),retry=await exit(d,{},key);expect(first.status).toBe(201);expect(retry.body.data.id_entrega).toBe(first.body.data.id_entrega);expect(retry.body.data.repetido).toBe(true);expect((await exit(d,{observaciones:'Otros datos diferentes'},key)).status).toBe(409);
 });
 test('resumen e identidad históricos; entregado desaparece del aula/comedor',async()=>{
   const c=await fixture();await db.execute("INSERT INTO registros_alimentacion(id_asistencia,tipo_comida,racion,observaciones,id_usuario) VALUES (?,'COMIDA','NADA','Observación original',?)",[c.attendance,teacher.id_usuario]);expect((await exit(c)).status).toBe(201);
   await db.execute("UPDATE personas SET nombre='Nombre posterior' WHERE id_persona=?",[c.person]);await db.execute("UPDATE registros_alimentacion SET observaciones='Dato posterior' WHERE id_asistencia=?",[c.attendance]);const detail=await call(cs,'get',`/recepcion/salidas/${c.attendance}`);expect(detail.body.data.entrega.identidad_receptor.nombre).toBe('Persona ficticia autorizada');expect(detail.body.data.entrega.resumen_diario.alimentacion[0].observaciones).toBe('Observación original');expect(detail.text).not.toContain('solicitud_hash');
   const classroom=await call(ts,'get',`/aulas/grupos/${group.id_grupo}/insumos`);expect(classroom.body.data.menores.some(m=>m.id_menor===c.child)).toBe(false);const dining=await call(ts,'get','/comedor/presentes');expect(dining.body.data.menores.some(m=>m.id_menor===c.child)).toBe(false);
 });
 test('comedor abierto bloquea entrega hasta el regreso acompañado',async()=>{
   const c=await fixture();const [t]=await db.execute('INSERT INTO traslados_comedor(id_asistencia,entrada_at,id_responsable) VALUES (?,?,?)',[c.attendance,`${today} 18:00:00`,teacher.id_usuario]);expect((await exit(c)).body.error.code).toBe('DINING_STILL_OPEN');await db.execute('UPDATE traslados_comedor SET salida_at=? WHERE id_traslado=?',[`${today} 20:00:00`,t.insertId]);expect((await exit(c)).status).toBe(201);
 });
 test('no usa asistencia antigua; baja administrativa no retiene al menor',async()=>{
   const c=await fixture();const previous=new Date(`${today}T00:00:00Z`);previous.setUTCDate(previous.getUTCDate()-1);await db.execute('UPDATE asistencias SET fecha=? WHERE id_asistencia=?',[previous.toISOString().slice(0,10),c.attendance]);expect((await exit(c)).body.error.code).toBe('ATTENDANCE_DATE');await db.execute('UPDATE asistencias SET fecha=? WHERE id_asistencia=?',[today,c.attendance]);await db.execute("UPDATE menores SET estatus='BAJA' WHERE id_menor=?",[c.child]);expect((await exit(c)).status).toBe(201);
 });
 test('roles, CSRF, confirmaciones, métodos y clave; sin biometría ni actor cliente',async()=>{
   const c=await fixture();for(const s of [ts,ns]){expect((await exit(c,{},randomUUID(),s)).status).toBe(403);expect((await call(s,'get','/recepcion/salidas')).status).toBe(403);}
   for(const extra of [{identidad_verificada:false},{confirmacion:false},{metodo_verificacion:'BIOMETRIA_EXTERNA'},{id_usuario:admin.id_usuario},{id_vinculo:null}])expect((await exit(c,extra)).status).toBe(400);
   expect((await call(cs,'post','/recepcion/salida',payload(c))).status).toBe(400);expect((await request(app).post('/api/v1/recepcion/salida').set('Cookie',cs.cookie).send(payload(c))).status).toBe(403);
 });
});
