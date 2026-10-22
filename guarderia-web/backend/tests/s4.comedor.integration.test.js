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
import {privateStorage} from '../src/modules/documentos/storage.js';
describe.skipIf(process.env.RUN_DB_TESTS!=='true')('S4 comedor: MySQL real y restricciones estructuradas',()=>{
  let db,app,admin,teacher,nurse,other,clerk,group,as,ts,ns,os,cs,allowed,forbidden,safeDish,badDish,seq=0;
  const suffix=randomBytes(4).toString('hex'),password=randomBytes(18).toString('hex'),today=civilDate();let instant=`${today}T18:00:00Z`;
  const config={secret:'s4-comedor-private-test-secret-at-least-32',secure:false,origin:'http://localhost:5173',documentKey:randomBytes(32).toString('hex'),uploadDir:`/tmp/s4food-${suffix}`,clock:()=>new Date(instant)};
  const call=(s,method,path,body,key)=>{const r=request(app)[method](`/api/v1${path}`).set('Cookie',s.cookie).set('X-CSRF-Token',s.csrf);if(key)r.set('Idempotency-Key',key);return body?r.send(body):r;};
  const day=n=>{const d=new Date(`${today}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  async function login(u){const r=await request(app).post('/api/v1/auth/login').send({email:u.email,password});expect(r.status).toBe(200);return {cookie:r.headers['set-cookie'][0].split(';')[0],csrf:r.body.data.csrfToken};}
  async function child(birth=addMonths(today,-14)){
    instant=`${today}T18:00:00Z`;const [m]=await db.execute("INSERT INTO menores(codigo,nombres,apellido_paterno,fecha_nacimiento,estatus) VALUES (?,'Ficticio','Comedor',?,'ACTIVO')",[`C4-${suffix}-${++seq}`,birth]);await db.execute('INSERT INTO historial_grupos(id_menor,id_grupo,fecha_inicio) VALUES (?,?,?)',[m.insertId,group.id_grupo,today]);
    const [i]=await db.execute("INSERT INTO intentos_ingreso(id_menor,id_usuario,intento_at,resultado) VALUES (?,?,?,'ACEPTADO')",[m.insertId,admin.id_usuario,`${today} 14:15:00`]);const [a]=await db.execute('INSERT INTO asistencias(id_menor,id_intento,fecha,ingreso_at) VALUES (?,?,?,?)',[m.insertId,i.insertId,today,`${today} 14:15:00`]);return {id:m.insertId,attendance:a.insertId};
  }
  const enter=(c,s=ts,key=randomUUID())=>call(s,'post','/comedor/traslados',{id_asistencia:c.attendance,confirmacion_acompanamiento:true},key);
  const meal=(c,extra={},key=randomUUID(),s=ts)=>call(s,'post','/comedor/registros',{id_asistencia:c.attendance,id_platillo:safeDish,tipo_comida:'COMIDA',racion:'COMPLETA',confirmacion_revision:true,observaciones:'Consumo ficticio cotejado',...extra},key);
  async function restriction(c,{type='ALERGIA_BASE',end=null,recipe=null}={}){const [r]=await db.execute('INSERT INTO restricciones_alimentarias(id_menor,id_receta,tipo,descripcion,inicio,fin) VALUES (?,?,?,?,?,?)',[c.id,recipe,type,'Restricción ficticia de ingrediente',day(-1),end]);return r.insertId;}
  const review=id=>call(ns,'post',`/comedor/restricciones/${id}/revision`,{ingredientes_prohibidos:[forbidden],alcance:'EXCLUSION_INGREDIENTES',confirmacion:true,observaciones:'Cotejo clínico ficticio de exclusión'});
  beforeAll(async()=>{
    if(process.env.DB_HOST!=='mysql-test')throw new Error('Fixtures solo mysql-test');db=createDatabase();app=createApp(db,config);
    const create=(rol,label)=>usuariosService(db).create(userSchema.parse({nombre:`Ficticio comedor ${label}`,email:`c4-${label}-${suffix}@example.test`,password,rol}),null);
    admin=await create('ADMIN','admin');teacher=await create('EDUCADORA','teacher');nurse=await create('ENFERMERIA','nurse');other=await create('EDUCADORA','other');clerk=await create('RECEPCION','clerk');
    group=await gruposService(db).create({codigo:`C4-${suffix}`,nombre:'Grupo ficticio comedor',id_categoria:2,capacidad:100,activo:true,id_responsable:teacher.id_usuario},admin.id_usuario);
    as=await login(admin);ts=await login(teacher);ns=await login(nurse);os=await login(other);cs=await login(clerk);
    for(const [name,set] of [[`Permitido-${suffix}`,id=>{allowed=id;}],[`Prohibido-${suffix}`,id=>{forbidden=id;}]]){const r=await call(as,'post','/comedor/ingredientes',{nombre:name});expect(r.status).toBe(201);set(r.body.data.id_ingrediente);}
    for(const [ids,set] of [[[allowed],id=>{safeDish=id;}],[[allowed,forbidden],id=>{badDish=id;}]]){const r=await call(ns,'post','/comedor/platillos',{nombre:`Platillo ficticio ${suffix}`,ingredientes:ids,confirmacion_composicion:true});expect(r.status).toBe(201);set(r.body.data.id_platillo);}
  });
  afterAll(async()=>{await db?.end();});
  test('límite de edad: cumple un año/menor bloqueados, día posterior permitido',async()=>{
    const exact=addMonths(today,-12),younger=addMonths(day(1),-12),older=addMonths(day(-1),-12);
    for(const [birth,status] of [[exact,422],[younger,422],[older,201]])expect((await enter(await child(birth))).status).toBe(status);
  });
  test('traslado acompañado concurrente y reintento generan una entrada; salida usa reloj real',async()=>{
    const c=await child(),key=randomUUID();const r=await Promise.all([enter(c,ts,key),enter(c,ts,key)]);expect(r.map(x=>x.status)).toEqual([201,201]);expect(r[0].body.data.id_traslado).toBe(r[1].body.data.id_traslado);expect((await enter(c)).status).toBe(409);
    instant=`${today}T18:30:00Z`;const path=`/comedor/traslados/${r[0].body.data.id_traslado}/salida`;expect((await call(ts,'patch',path,{confirmacion_acompanamiento:true})).status).toBe(200);expect((await call(ts,'patch',path,{confirmacion_acompanamiento:true})).body.data.repetido).toBe(true);
    const [rows]=await db.execute('SELECT entrada_at,salida_at,id_responsable FROM traslados_comedor WHERE id_traslado=?',[r[0].body.data.id_traslado]);expect(rows[0]).toMatchObject({entrada_at:`${today} 18:00:00`,salida_at:`${today} 18:30:00`,id_responsable:teacher.id_usuario});expect((await meal(c)).body.error.code).toBe('DINING_TRANSFER_REQUIRED');
  });
  test('bloquea restricción basal no revisada e ingrediente prohibido sin guardar ración',async()=>{
    const c=await child(),id=await restriction(c);await enter(c);expect((await meal(c)).body.error.code).toBe('DIET_REVIEW_REQUIRED');expect((await review(id)).status).toBe(200);expect((await meal(c,{id_platillo:badDish})).body.error.code).toBe('INCOMPATIBLE_FOOD');
    const [rows]=await db.execute('SELECT COUNT(*) n FROM registros_alimentacion WHERE id_asistencia=?',[c.attendance]);expect(rows[0].n).toBe(0);
    const success=await meal(c);expect(success.status).toBe(201);const [records]=await db.execute('SELECT comprobacion FROM registros_alimentacion WHERE id_registro=?',[success.body.data.id_registro]);expect(records[0].comprobacion.restricciones[0].id_restriccion).toBe(id);expect(records[0].comprobacion.ingredientes[0].id_ingrediente).toBe(allowed);
    await call(ns,'post',`/comedor/restricciones/${id}/revision`,{ingredientes_prohibidos:[allowed],alcance:'EXCLUSION_INGREDIENTES',confirmacion:true,observaciones:'Nueva revisión ficticia'});const [saved]=await db.execute('SELECT comprobacion FROM registros_alimentacion WHERE id_registro=?',[success.body.data.id_registro]);expect(saved[0].comprobacion.restricciones[0].revision.ingredientes_prohibidos).toEqual([forbidden]);
    const withdrawal={confirmacion:true,motivo:'Revisión requiere nuevo cotejo'};expect((await call(ts,'patch',`/comedor/restricciones/${id}/revision`,withdrawal)).status).toBe(403);expect((await call(ns,'patch',`/comedor/restricciones/${id}/revision`,withdrawal)).status).toBe(200);expect((await meal(c,{tipo_comida:'MERIENDA'})).body.error.code).toBe('DIET_REVIEW_REQUIRED');
  });
  test('dietas vigentes requieren receta/documento; dieta vencida no afecta la ración',async()=>{
    const c=await child();await enter(c);const file=await privateStorage(config).write(Buffer.from('%PDF-1.4\ncontenido ficticio\n%%EOF'),'application/pdf');const [d]=await db.execute("INSERT INTO documentos_menor(id_menor,tipo,ruta_segura,hash_sha256,validado,uso) VALUES (?,'OTRO',?,?,1,'MEDICO')",[c.id,file.name,file.hash]);const [rx]=await db.execute('INSERT INTO recetas(id_menor,nombre_medico,cedula_profesional,fecha_consulta,vigencia_inicio,vigencia_fin,permite_convivencia,ruta_documento,verificada_por,verificada_at) VALUES (?,?,?,?,?,?,1,?,?,?)',[c.id,'Profesional ficticio','TEST-C4',day(-1),day(-1),today,`documento:${d.insertId}`,nurse.id_usuario,`${today} 16:00:00`]);
    const id=await restriction(c,{type:'DIETA_MEDICA_TEMPORAL',end:today,recipe:rx.insertId});await review(id);expect((await meal(c,{id_platillo:badDish})).body.error.code).toBe('INCOMPATIBLE_FOOD');await db.execute('UPDATE documentos_menor SET validado=0 WHERE id_documento=?',[d.insertId]);expect((await meal(c)).body.error.code).toBe('DIET_UNVERIFIABLE');await db.execute('UPDATE restricciones_alimentarias SET fin=? WHERE id_restriccion=?',[day(-1),id]);expect((await meal(c)).status).toBe(201);
  });
  test('ración idempotente y simultánea; no duplica un tipo de comida',async()=>{
    const c=await child();await enter(c);const key=randomUUID(),results=await Promise.all([meal(c,{},key),meal(c,{},key)]);expect(results.map(r=>r.status)).toEqual([201,201]);expect(results[0].body.data.id_registro).toBe(results[1].body.data.id_registro);expect((await meal(c)).status).toBe(409);expect((await meal(c,{racion:'MEDIA'},key)).status).toBe(409);
    const [rows]=await db.execute('SELECT COUNT(*) n FROM registros_alimentacion WHERE id_asistencia=?',[c.attendance]);expect(rows[0].n).toBe(1);
  });
  test.each(['CUARTO','MEDIA','TRES_CUARTOS','COMPLETA'])('persiste fracción %s',async racion=>{const c=await child();await enter(c);expect((await meal(c,{racion})).status).toBe(201);});
  test('NADA documenta ausencia de consumo sin platillo y no elude una incompatibilidad',async()=>{
    const c=await child();await restriction(c);await enter(c);expect((await meal(c,{racion:'NADA',id_platillo:badDish})).status).toBe(400);expect((await meal(c,{racion:'NADA',id_platillo:null,observaciones:'No consumió por restricción pendiente'})).status).toBe(201);
  });
  test('roles y grupo/presencia: enfermería no traslada; educadora no revisa ni crea platos',async()=>{
    const c=await child();expect((await enter(c,ns)).status).toBe(403);expect((await enter(c,os)).status).toBe(403);expect((await enter(c,cs)).status).toBe(403);
    expect((await call(ts,'post','/comedor/ingredientes',{nombre:'No autorizado'})).status).toBe(403);const id=await restriction(c);expect((await call(ts,'post',`/comedor/restricciones/${id}/revision`,{ingredientes_prohibidos:[allowed],alcance:'EXCLUSION_INGREDIENTES',confirmacion:true,observaciones:'No autorizado'})).status).toBe(403);
    const read=await call(os,'get','/comedor/presentes');expect(read.body.data.menores.some(m=>m.id_menor===c.id)).toBe(false);await db.execute('UPDATE asistencias SET fecha=? WHERE id_asistencia=?',[day(-1),c.attendance]);expect((await enter(c)).body.error.code).toBe('ATTENDANCE_DATE');
  });
  test('validaciones estrictas: acompañamiento, CSRF, ingredientes y tiempos/actor del cliente',async()=>{
    const c=await child();for(const extra of [{confirmacion_acompanamiento:false},{entrada_at:'2000-01-01'},{id_responsable:admin.id_usuario}])expect((await call(ts,'post','/comedor/traslados',{id_asistencia:c.attendance,confirmacion_acompanamiento:true,...extra},randomUUID())).status).toBe(400);
    const missing=await request(app).post('/api/v1/comedor/traslados').set('Cookie',ts.cookie).send({id_asistencia:c.attendance,confirmacion_acompanamiento:true});expect(missing.status).toBe(403);
    expect((await call(ns,'post','/comedor/platillos',{nombre:'Inválido',ingredientes:[999999999],confirmacion_composicion:true})).status).toBe(422);expect((await call(ns,'post','/comedor/platillos',{nombre:'Duplicado',ingredientes:[allowed,allowed],confirmacion_composicion:true})).status).toBe(400);
  });
});
