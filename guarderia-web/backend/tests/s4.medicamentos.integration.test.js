import {describe,test,beforeAll,afterAll,expect,vi} from 'vitest';
import request from 'supertest';
import {randomBytes,randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createDatabase} from '../src/config/database.js';
import {createApp} from '../src/app.js';
import {usuariosService} from '../src/modules/usuarios/usuarios.service.js';
import {userSchema} from '../src/modules/usuarios/usuarios.validation.js';
import {gruposService} from '../src/modules/grupos/grupos.service.js';
import {civilDate} from '../src/utils/transaction.js';
import {addMonths} from '../src/utils/dates.js';
import {medicamentosService} from '../src/modules/medicamentos/medicamentos.service.js';
import {startMedicationScheduler} from '../src/modules/medicamentos/medicamentos.scheduler.js';
test('planificador se recupera de fallo, repite ciclos y se detiene sin ciclos adicionales',async()=>{
  vi.useFakeTimers();const synchronize=vi.fn().mockRejectedValueOnce(new Error('fallo')).mockResolvedValue({creadas:0}),onError=vi.fn();
  try{const stop=startMedicationScheduler({synchronize},{delay:100,onError});await vi.advanceTimersByTimeAsync(250);expect(synchronize).toHaveBeenCalledTimes(3);expect(onError).toHaveBeenCalledTimes(1);await stop();await vi.advanceTimersByTimeAsync(500);expect(synchronize).toHaveBeenCalledTimes(3);}finally{vi.useRealTimers();}
});
describe.skipIf(process.env.RUN_DB_TESTS!=='true')('S4: dosis persistentes con MySQL y archivos reales',()=>{
  let db,app,service,admin,teacher,nurse,other,clerk,group,adminSession,teacherSession,nurseSession,otherSession,clerkSession,seq=0;
  const suffix=randomBytes(4).toString('hex'),password=randomBytes(18).toString('hex'),today=civilDate();let instant=`${today}T14:15:00Z`;
  const config={secret:'s4-medicines-test-private-secret-at-least-32',secure:false,origin:'http://localhost:5173',documentKey:randomBytes(32).toString('hex'),uploadDir:`/tmp/s4med-${suffix}`,clock:()=>new Date(instant)};
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
  const call=(session,method,path,body,key)=>{const r=request(app)[method](`/api/v1${path}`).set('Cookie',session.cookie).set('X-CSRF-Token',session.csrf);if(key)r.set('Idempotency-Key',key);return body?r.send(body):r;};
  async function login(u){const r=await request(app).post('/api/v1/auth/login').send({email:u.email,password});expect(r.status).toBe(200);return {cookie:r.headers['set-cookie'][0].split(';')[0],csrf:r.body.data.csrfToken};}
  async function fixture({via='ORAL',present=true}={}){
    instant=`${today}T14:15:00Z`;
    const [r]=await db.execute("INSERT INTO menores(codigo,nombres,apellido_paterno,fecha_nacimiento,curp,estatus,registro_civil_validado,requerimientos_insumos_revisados) VALUES (?,'Menor ficticio','Medicamentos',?,?,'ACTIVO',1,1)",[`M4-${suffix}-${++seq}`,addMonths(today,-6),randomBytes(9).toString('hex').toUpperCase()]);const id=r.insertId;
    await db.execute('INSERT INTO historial_grupos(id_menor,id_grupo,fecha_inicio) VALUES (?,?,?)',[id,group.id_grupo,today]);
    for(const type of ['ACTA_NACIMIENTO','CURP'])await db.execute("INSERT INTO documentos_menor(id_menor,tipo,ruta_segura,validado) VALUES (?,?,'fixture-med-civil',1)",[id,type]);
    const upload=await request(app).post(`/api/v1/recetas/documentos/${id}`).set('Cookie',adminSession.cookie).set('X-CSRF-Token',adminSession.csrf).set('Content-Type','application/pdf').send(pdf);expect(upload.status).toBe(201);
    const recipe=await call(adminSession,'post','/recetas',{id_menor:id,id_documento:upload.body.data.id_documento,nombre_medico:'Profesional ficticio',cedula_profesional:'TEST-M4',fecha_consulta:today,vigencia_inicio:today,vigencia_fin:today,permite_convivencia:true,confirmacion_revision:true,confirmacion_prescripcion:true,tratamientos:[{medicamento:'Sustancia ficticia',dosis:1.5,unidad:'ml',via,fecha_inicio:today,fecha_fin:today,dosificador_requerido:true,horarios:['08:30','12:00']}],restricciones:[]});expect(recipe.status).toBe(201);
    const t=recipe.body.data.tratamientos[0];expect((await call(adminSession,'patch',`/recetas/tratamientos/${t.id_tratamiento}/dosificador`,{entregado:true,tipo:'GRADUADO'})).status).toBe(200);
    if(present)expect((await call(adminSession,'post','/recepcion/ingreso',{id_menor:id,sintomas:false,indicio_contagio:false,pendiente_relevante:false,requiere_tratamiento:false,dieta_temporal_requerida:false,inspeccion:{confirmada:true,area:'CUNERO',lesiones:[]}})).status).toBe(201);
    const [before]=await db.execute('SELECT COUNT(*) n FROM administraciones_medicamento a JOIN horarios_tratamiento h USING(id_horario) WHERE h.id_tratamiento=?',[t.id_tratamiento]);expect(before[0].n).toBe(present?2:0);
    await service.synchronize();const [rows]=await db.execute('SELECT a.id_administracion,h.hora FROM administraciones_medicamento a JOIN horarios_tratamiento h USING(id_horario) WHERE h.id_tratamiento=? AND a.fecha_programada=? ORDER BY h.hora',[t.id_tratamiento,today]);
    return {id,treatment:t.id_tratamiento,recipe:recipe.body.data.id_receta,document:upload.body.data.id_documento,doses:rows};
  }
  const payload=(extra={})=>({estado:'APLICADA',dosis_aplicada:1.5,confirmacion_identidad:true,confirmacion_prescripcion:true,observaciones:'Identidad y prescripción cotejadas en prueba',...extra});
  const resolve=(c,body=payload(),session=teacherSession,key=randomUUID(),index=0)=>call(session,'post',`/medicamentos/dosis/${c.doses[index].id_administracion}/registro`,body,key);
  beforeAll(async()=>{
    if(process.env.DB_HOST!=='mysql-test')throw new Error('Solo mysql-test admite fixtures');db=createDatabase();app=createApp(db,config);service=medicamentosService(db,config);
    const create=(rol,label)=>usuariosService(db).create(userSchema.parse({nombre:`Ficticio M4 ${label}`,email:`m4-${label}-${suffix}@example.test`,password,rol}),null);
    admin=await create('ADMIN','admin');teacher=await create('EDUCADORA','teacher');nurse=await create('ENFERMERIA','nurse');other=await create('EDUCADORA','other');clerk=await create('RECEPCION','clerk');
    group=await gruposService(db).create({codigo:`M4-${suffix}`,nombre:'Grupo ficticio de dosis',id_categoria:1,capacidad:100,activo:true,id_responsable:teacher.id_usuario},admin.id_usuario);
    adminSession=await login(admin);teacherSession=await login(teacher);nurseSession=await login(nurse);otherSession=await login(other);clerkSession=await login(clerk);
  });
  afterAll(async()=>{await db?.end();});
  test('sincronización sin navegador crea dos pendientes y reinicio/concurrencia no duplica',async()=>{
    const c=await fixture();expect(c.doses).toHaveLength(2);await Promise.all([service.synchronize(),medicamentosService(db,config).synchronize()]);
    const [rows]=await db.execute('SELECT estado FROM administraciones_medicamento a JOIN horarios_tratamiento h USING(id_horario) WHERE h.id_tratamiento=?',[c.treatment]);expect(rows).toHaveLength(2);expect(rows.every(r=>r.estado==='PENDIENTE')).toBe(true);
    const absent=await fixture({present:false});expect(absent.doses).toHaveLength(0);
  });
  test('antes del horario no se resuelve y alerta se recupera al llegar el reloj',async()=>{
    const c=await fixture();expect((await resolve(c)).body.error.code).toBe('DOSE_NOT_DUE');instant=`${today}T14:30:00Z`;
    const result=await call(teacherSession,'get','/medicamentos/dosis');expect(result.status).toBe(200);expect(result.body.data.dosis.find(d=>d.id_administracion===c.doses[0].id_administracion)).toMatchObject({alerta:true,puede_aplicar:true});expect(result.text).not.toContain('ruta_segura');expect(result.text).not.toContain('hash_sha256');
  });
  test('dos aplicaciones concurrentes registran una y nunca sobreescriben responsable/dosis',async()=>{
    const c=await fixture();instant=`${today}T14:30:00Z`;const results=await Promise.all([resolve(c),resolve(c)]);expect(results.map(r=>r.status).sort()).toEqual([200,409]);
    const [rows]=await db.execute('SELECT estado,id_usuario,dosis_aplicada,aplicada_at FROM administraciones_medicamento WHERE id_administracion=?',[c.doses[0].id_administracion]);expect(rows[0]).toMatchObject({estado:'APLICADA',id_usuario:teacher.id_usuario,dosis_aplicada:'1.500',aplicada_at:`${today} 14:30:00`});
    const [audit]=await db.execute("SELECT COUNT(*) n FROM auditoria_eventos WHERE entidad='administraciones_medicamento' AND entidad_id=? AND accion='APLICADA'",[c.doses[0].id_administracion]);expect(audit[0].n).toBe(1);
  });
  test('reintento exacto es idempotente y cambiar contenido con la clave devuelve 409',async()=>{
    const c=await fixture();instant=`${today}T14:30:00Z`;const key=randomUUID();expect((await resolve(c,payload(),teacherSession,key)).status).toBe(200);expect((await resolve(c,payload(),teacherSession,key)).body.data.repetido).toBe(true);expect((await resolve(c,payload({observaciones:'Otros datos distintos'}),teacherSession,key)).status).toBe(409);
  });
  test('dosis distinta, dosificador ausente y menor sin presencia impiden aplicación',async()=>{
    const c=await fixture();instant=`${today}T14:30:00Z`;expect((await resolve(c,payload({dosis_aplicada:2}))).body.error.code).toBe('DOSE_MISMATCH');
    await db.execute('UPDATE tratamientos SET dosificador_entregado=0 WHERE id_tratamiento=?',[c.treatment]);expect((await resolve(c)).body.error.code).toBe('DISPENSER_REQUIRED');await db.execute('UPDATE tratamientos SET dosificador_entregado=1 WHERE id_tratamiento=?',[c.treatment]);
    await db.execute("UPDATE menores SET estatus='BAJA' WHERE id_menor=?",[c.id]);expect((await resolve(c)).body.error.code).toBe('CHILD_NOT_PRESENT');
  });
  test('otra educadora/recepción no operan; vía OTRA requiere enfermería/admin',async()=>{
    const c=await fixture({via:'OTRA'});instant=`${today}T14:30:00Z`;
    expect((await resolve(c,payload(),otherSession)).status).toBe(403);expect((await resolve(c,payload(),clerkSession)).status).toBe(403);expect((await resolve(c)).body.error.code).toBe('ROUTE_FORBIDDEN');expect((await resolve(c,payload(),nurseSession)).status).toBe(200);
    const list=await call(otherSession,'get','/medicamentos/dosis');expect(list.body.data.dosis.some(d=>d.id_menor===c.id)).toBe(false);
  });
  test('educadora asignada registra vía tópica; asistencia de otro día no permite aplicar',async()=>{
    const c=await fixture({via:'TOPICA'});instant=`${today}T14:30:00Z`;expect((await resolve(c)).status).toBe(200);
    const absent=await fixture();instant=`${today}T14:30:00Z`;await db.execute('UPDATE asistencias SET fecha=DATE_SUB(?,INTERVAL 1 DAY) WHERE id_menor=?',[today,absent.id]);expect((await resolve(absent)).body.error.code).toBe('CHILD_NOT_PRESENT');
  });
  test('documento alterado bloquea aplicación sin cambiar pendiente',async()=>{
    const c=await fixture();instant=`${today}T14:30:00Z`;const [docs]=await db.execute('SELECT ruta_segura FROM documentos_menor WHERE id_documento=?',[c.document]);await writeFile(join(config.uploadDir,docs[0].ruta_segura),Buffer.from('archivo alterado'));
    const r=await resolve(c);expect(r.status).toBe(500);expect(r.body.error.code).toBe('DOCUMENT_INTEGRITY');const [rows]=await db.execute('SELECT estado FROM administraciones_medicamento WHERE id_administracion=?',[c.doses[0].id_administracion]);expect(rows[0].estado).toBe('PENDIENTE');
  });
  test('suspensión conserva historial, bloquea aplicación y detiene nuevas programaciones',async()=>{
    const c=await fixture(),path=`/medicamentos/tratamientos/${c.treatment}/suspension`,body={confirmacion:true,motivo:'Suspensión documentada ficticia'};
    expect((await call(teacherSession,'post',path,body)).status).toBe(403);expect((await call(nurseSession,'post',path,body)).status).toBe(200);expect((await call(nurseSession,'post',path,body)).body.data.repetido).toBe(true);
    instant=`${today}T14:30:00Z`;expect((await resolve(c)).body.error.code).toBe('PRESCRIPTION_INVALID');expect((await resolve(c,payload({estado:'OMITIDA',dosis_aplicada:null,observaciones:'Tratamiento suspendido'}))).status).toBe(200);
    await db.execute("INSERT INTO horarios_tratamiento(id_tratamiento,hora) VALUES (?,'16:00:00')",[c.treatment]);await service.synchronize();const [rows]=await db.execute('SELECT COUNT(*) n FROM administraciones_medicamento a JOIN horarios_tratamiento h USING(id_horario) WHERE h.id_tratamiento=?',[c.treatment]);expect(rows[0].n).toBe(2);
  });
  test('dosis pasada queda pendiente tras reinicio, no se aplica hoy y puede documentarse omisión',async()=>{
    const c=await fixture();const next=new Date(`${today}T14:30:00Z`);next.setUTCDate(next.getUTCDate()+1);instant=next.toISOString();
    const restarted=createApp(db,config);const read=await request(restarted).get('/api/v1/medicamentos/dosis').set('Cookie',teacherSession.cookie);expect(read.body.data.dosis.find(d=>d.id_administracion===c.doses[0].id_administracion)).toMatchObject({estado:'PENDIENTE',alerta:true,puede_aplicar:false});
    expect((await resolve(c)).body.error.code).toBe('PRESCRIPTION_INVALID');expect((await resolve(c,payload({estado:'OMITIDA',dosis_aplicada:null,observaciones:'Dosis no aplicada; revisión al día siguiente'}))).status).toBe(200);
  });
  test('payload estricto exige confirmaciones, razón, clave y CSRF; no acepta hora/actor cliente',async()=>{
    const c=await fixture();instant=`${today}T14:30:00Z`;
    for(const extra of [{confirmacion_identidad:false},{observaciones:''},{aplicada_at:'2020-01-01'},{id_usuario:admin.id_usuario},{estado:'OMITIDA',dosis_aplicada:1.5}])expect((await resolve(c,payload(extra))).status).toBe(400);
    expect((await call(teacherSession,'post',`/medicamentos/dosis/${c.doses[0].id_administracion}/registro`,payload())).status).toBe(400);
    const noCsrf=await request(app).post(`/api/v1/medicamentos/dosis/${c.doses[0].id_administracion}/registro`).set('Cookie',teacherSession.cookie).set('Idempotency-Key',randomUUID()).send(payload());expect(noCsrf.status).toBe(403);
  });
});
