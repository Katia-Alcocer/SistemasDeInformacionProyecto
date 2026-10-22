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
import {supplyAlert} from '../src/modules/insumos/insumos.alerts.js';

test('estimaciones en milésimas: 3/2/1/0, fracciones, sin tasa y sin stock',()=>{
  for(const [amount,rate,days] of [[6,2,3],[4,2,2],[2,2,1],[0,2,0],[0.299,0.1,2],[0.3,0.1,3],[0.05,0.1,0],[1,null,null],[0,null,0]]){
    const result=supplyAlert({cantidad_actual:amount,consumo_diario_estimado:rate});expect(result.dias_estimados).toBe(days);expect(result.nivel_aviso).toBe(days);
  }
  expect(supplyAlert({cantidad_actual:20,consumo_diario_estimado:2}).nivel_aviso).toBeNull();
});
describe.skipIf(process.env.RUN_DB_TESTS!=='true')('S4: inventario de aula con MySQL real',()=>{
  let db,app,admin,teacher,other,clerk,group,adminSession,teacherSession,otherSession,clerkSession,seq=0;
  const suffix=randomBytes(4).toString('hex'),password=randomBytes(18).toString('hex'),today=civilDate();
  const config={secret:'s4-inventory-private-test-secret-at-least-32',secure:false,origin:'http://localhost:5173',clock:()=>new Date(`${today}T14:15:00Z`)};
  const call=(session,method,path,data,key)=>{const r=request(app)[method](`/api/v1${path}`).set('Cookie',session.cookie).set('X-CSRF-Token',session.csrf);if(key)r.set('Idempotency-Key',key);return data?r.send(data):r;};
  async function login(user){const r=await request(app).post('/api/v1/auth/login').send({email:user.email,password});expect(r.status).toBe(200);return {cookie:r.headers['set-cookie'][0].split(';')[0],csrf:r.body.data.csrfToken};}
  async function fixture({balance=6,present=true,rate=2}={}){
    const [r]=await db.execute("INSERT INTO menores(codigo,nombres,apellido_paterno,fecha_nacimiento,estatus,curp,registro_civil_validado,requerimientos_insumos_revisados) VALUES (?,'Ficticio S4','Prueba',?,'ACTIVO',?,1,1)",[`S4-${suffix}-${++seq}`,addMonths(today,-6),randomBytes(9).toString('hex').toUpperCase()]);
    const id=r.insertId;await db.execute('INSERT INTO historial_grupos(id_menor,id_grupo,fecha_inicio) VALUES (?,?,?)',[id,group.id_grupo,today]);
    for(const type of ['ACTA_NACIMIENTO','CURP'])await db.execute("INSERT INTO documentos_menor(id_menor,tipo,ruta_segura,validado) VALUES (?,?,'fixture-s4-sin-archivo',1)",[id,type]);
    const [item]=await db.execute('INSERT INTO insumos_menor(id_menor,id_tipo_insumo,cantidad_actual,consumo_diario_estimado,cantidad_requerida_ingreso,obligatorio) VALUES (?,1,?,?,1,1)',[id,balance,rate]);
    const intake=()=>call(adminSession,'post','/recepcion/ingreso',{id_menor:id,sintomas:false,indicio_contagio:false,pendiente_relevante:false,requiere_tratamiento:false,dieta_temporal_requerida:false,inspeccion:{confirmada:true,area:'CUNERO',lesiones:[]}});
    if(present)expect((await intake()).status).toBe(201);
    return {id,item:item.insertId,intake};
  }
  const move=(c,extra={})=>({id_insumo_menor:c.item,tipo:'CONSUMO',cantidad:1,motivo:'Consumo ficticio comprobado',...extra});
  beforeAll(async()=>{
    if(process.env.DB_HOST!=='mysql-test')throw new Error('Fixtures permitidos solo en mysql-test');db=createDatabase();app=createApp(db,config);
    const create=(role,label)=>usuariosService(db).create(userSchema.parse({nombre:`Ficticio S4 ${label}`,email:`s4-${label}-${suffix}@example.test`,password,rol:role}),null);
    admin=await create('ADMIN','admin');teacher=await create('EDUCADORA','teacher');other=await create('EDUCADORA','other');clerk=await create('RECEPCION','clerk');
    group=await gruposService(db).create({codigo:`S4-${suffix}`,nombre:'Aula ficticia S4',id_categoria:1,capacidad:100,activo:true,id_responsable:teacher.id_usuario},admin.id_usuario);
    adminSession=await login(admin);teacherSession=await login(teacher);otherSession=await login(other);clerkSession=await login(clerk);
  });
  afterAll(async()=>{await db?.end();});
  test('educadora consulta solo su grupo y menores presentes, sin CURP ni archivos privados',async()=>{
    const c=await fixture(),absent=await fixture({present:false});
    const groups=await call(teacherSession,'get','/aulas/grupos');expect(groups.body.data.map(g=>g.id_grupo)).toEqual([group.id_grupo]);
    const result=await call(teacherSession,'get',`/aulas/grupos/${group.id_grupo}/insumos`);expect(result.status).toBe(200);expect(result.body.data.menores.some(m=>m.id_menor===c.id)).toBe(true);expect(result.body.data.menores.some(m=>m.id_menor===absent.id)).toBe(false);expect(result.text).not.toContain('curp');expect(result.text).not.toContain('ruta_segura');
    expect((await call(otherSession,'get',`/aulas/grupos/${group.id_grupo}/insumos`)).status).toBe(403);
    expect((await call(clerkSession,'get','/aulas/grupos')).status).toBe(403);
    expect((await call(teacherSession,'get',`/insumos/menor/${c.id}`)).status).toBe(403);
  });
  test('alias y endpoint principal comparten idempotencia y guardan delta negativo',async()=>{
    const c=await fixture(),key=randomUUID(),body=move(c,{cantidad:0.125});
    const first=await call(teacherSession,'put','/aulas/insumos/descontar',body,key);expect(first.status).toBe(201);expect(first.body.data.saldo_resultante).toBe('5.875');
    const retry=await call(teacherSession,'post','/insumos/movimientos',body,key);expect(retry.body.data.repetido).toBe(true);expect(retry.body.data.id_movimiento).toBe(first.body.data.id_movimiento);
    expect((await call(teacherSession,'put','/aulas/insumos/descontar',{...body,cantidad:2},key)).status).toBe(409);
    const [rows]=await db.execute('SELECT tipo,cantidad_delta,id_usuario FROM movimientos_insumo WHERE id_movimiento=?',[first.body.data.id_movimiento]);expect(rows[0]).toMatchObject({tipo:'CONSUMO',cantidad_delta:'-0.125',id_usuario:teacher.id_usuario});
  });
  test('dos consumos simultáneos no producen saldo negativo ni movimiento rechazado',async()=>{
    const c=await fixture({balance:1});const results=await Promise.all([1,2].map(()=>call(teacherSession,'put','/aulas/insumos/descontar',move(c),randomUUID())));expect(results.map(r=>r.status).sort()).toEqual([201,422]);
    const [stock]=await db.execute('SELECT cantidad_actual FROM insumos_menor WHERE id_insumo_menor=?',[c.item]);const [moves]=await db.execute('SELECT COUNT(*) n FROM movimientos_insumo WHERE id_insumo_menor=?',[c.item]);expect(stock[0].cantidad_actual).toBe('0.000');expect(moves[0].n).toBe(1);
  });
  test('avisa 3/2/1/0, conserva contactos sin duplicarlos y rechaza aviso obsoleto',async()=>{
    const c=await fixture();
    for(const days of [3,2,1,0]){
      const read=await call(adminSession,'get',`/insumos/menor/${c.id}`);expect(read.body.data.insumos[0].nivel_aviso).toBe(days);
      const body={id_insumo_menor:c.item,dias_estimados:days,confirmacion_contacto:true,observaciones:'Contacto ficticio por canal institucional'};
      const notice=await call(teacherSession,'post','/aulas/insumos/avisos',body);expect(notice.status).toBe(201);
      expect((await call(teacherSession,'post','/aulas/insumos/avisos',body)).body.data.repetido).toBe(true);
      if(days>0)expect((await call(teacherSession,'put','/aulas/insumos/descontar',move(c,{cantidad:2}),randomUUID())).status).toBe(201);
    }
    const [notices]=await db.execute('SELECT dias_estimados,notificado_por FROM avisos_insumo WHERE id_insumo_menor=? ORDER BY id_aviso',[c.item]);expect(notices.map(n=>n.dias_estimados)).toEqual([3,2,1,0]);expect(notices.every(n=>n.notificado_por===teacher.id_usuario)).toBe(true);
    expect((await call(teacherSession,'post','/aulas/insumos/avisos',{id_insumo_menor:c.item,dias_estimados:3,confirmacion_contacto:true,observaciones:'Aviso anterior obsoleto'})).status).toBe(409);
    const restarted=createApp(db,config),read=await request(restarted).get(`/api/v1/insumos/menor/${c.id}`).set('Cookie',adminSession.cookie);expect(read.body.data.avisos).toHaveLength(4);expect(read.body.data.insumos[0].nivel_aviso).toBe(0);
    const zero=await fixture({balance:0,present:false});const rejection=await zero.intake();expect(rejection.status).toBe(422);expect(rejection.body.data.motivos.some(m=>m.codigo==='INSUMO_INSUFICIENTE')).toBe(true);
  });
  test('ajustes firmados exclusivos ADMIN, sin cero, sin desbordamiento ni saldo negativo',async()=>{
    const c=await fixture();
    for(const session of [teacherSession,clerkSession])expect((await call(session,'post','/insumos/movimientos',move(c,{tipo:'AJUSTE',cantidad:-1}),randomUUID())).status).toBe(403);
    expect((await call(adminSession,'post','/insumos/movimientos',move(c,{tipo:'AJUSTE',cantidad:-1.001}),randomUUID())).body.data.saldo_resultante).toBe('4.999');
    expect((await call(adminSession,'post','/insumos/movimientos',move(c,{tipo:'AJUSTE',cantidad:-5}),randomUUID())).status).toBe(422);
    expect((await call(adminSession,'post','/insumos/movimientos',move(c,{tipo:'ENTRADA',cantidad:999999999.999}),randomUUID())).status).toBe(422);
    for(const cantidad of [0,-1,0.0001])expect((await call(teacherSession,'put','/aulas/insumos/descontar',move(c,{cantidad}),randomUUID())).status).toBe(400);
    expect((await call(teacherSession,'put','/aulas/insumos/descontar',move(c))).status).toBe(400);
    const noCsrf=await request(app).put('/api/v1/aulas/insumos/descontar').set('Cookie',teacherSession.cookie).set('Idempotency-Key',randomUUID()).send(move(c));expect(noCsrf.status).toBe(403);
    expect((await call(teacherSession,'put','/aulas/insumos/descontar',{...move(c),id_usuario:admin.id_usuario},randomUUID())).status).toBe(400);
  });
  test('actividad atómica, responsable real, idempotencia concurrente y consulta persistida',async()=>{
    const c=await fixture();const [a]=await db.execute('SELECT id_asistencia FROM asistencias WHERE id_menor=? AND fecha=?',[c.id,today]);
    const body={titulo:'Lectura ficticia',descripcion:'Actividad ficticia para prueba',participantes:[{id_asistencia:a[0].id_asistencia,observaciones:'Participó en la lectura'}]},path=`/aulas/grupos/${group.id_grupo}/actividades`,key=randomUUID();
    const results=await Promise.all([1,2].map(()=>call(teacherSession,'post',path,body,key)));expect(results.map(r=>r.status)).toEqual([201,201]);expect(results[0].body.data.id_actividad).toBe(results[1].body.data.id_actividad);expect(results.filter(r=>r.body.data.repetido)).toHaveLength(1);
    const read=await call(teacherSession,'get',path);const saved=read.body.data.actividades.find(r=>r.id_actividad===results[0].body.data.id_actividad);expect(saved).toMatchObject({fecha:today,id_educadora:teacher.id_usuario,titulo:body.titulo});expect(saved.participantes).toHaveLength(1);expect(saved).not.toHaveProperty('solicitud_hash');
    expect((await call(teacherSession,'post',path,{...body,titulo:'Contenido distinto'},key)).status).toBe(409);
    const [audit]=await db.execute("SELECT COUNT(*) n FROM auditoria_eventos WHERE entidad='actividades_aula' AND entidad_id=? AND accion='REGISTRAR_ACTIVIDAD'",[saved.id_actividad]);expect(audit[0].n).toBe(1);
  });
  test('actividad rechaza participantes ajenos o de otra fecha y conserva atomicidad',async()=>{
    const c=await fixture(),otherChild=await fixture();const [a]=await db.execute('SELECT id_asistencia,id_menor FROM asistencias WHERE id_menor IN (?,?) ORDER BY id_menor',[c.id,otherChild.id]);
    await db.execute('UPDATE historial_grupos SET fecha_fin=? WHERE id_menor=?',[today,otherChild.id]);
    const path=`/aulas/grupos/${group.id_grupo}/actividades`,body={titulo:'Prueba de atomicidad',participantes:a.map(r=>({id_asistencia:r.id_asistencia}))};
    const invalid=await call(teacherSession,'post',path,body,randomUUID());expect(invalid.status).toBe(422);
    const [rows]=await db.execute('SELECT COUNT(*) n FROM actividades_aula WHERE id_grupo=? AND titulo=?',[group.id_grupo,body.titulo]);expect(rows[0].n).toBe(0);
    await db.execute('UPDATE asistencias SET fecha=DATE_SUB(?,INTERVAL 1 DAY) WHERE id_menor=?',[today,c.id]);expect((await call(teacherSession,'post',path,{...body,participantes:[body.participantes[0]]},randomUUID())).status).toBe(422);
    for(const participantes of [[],[body.participantes[0],body.participantes[0]]])expect((await call(teacherSession,'post',path,{...body,participantes},randomUUID())).status).toBe(400);
  });
  test('actividad protege rol/grupo, fecha y actor; historial restringido por asignación',async()=>{
    const c=await fixture();const [a]=await db.execute('SELECT id_asistencia FROM asistencias WHERE id_menor=?',[c.id]);const path=`/aulas/grupos/${group.id_grupo}/actividades`,body={titulo:'Actividad protegida',participantes:[{id_asistencia:a[0].id_asistencia}]};
    for(const session of [otherSession,clerkSession]){expect((await call(session,'get',path)).status).toBe(403);expect((await call(session,'post',path,body,randomUUID())).status).toBe(403);}
    for(const extra of [{fecha:'2020-01-01'},{id_educadora:admin.id_usuario}])expect((await call(teacherSession,'post',path,{...body,...extra},randomUUID())).status).toBe(400);
    expect((await call(teacherSession,'post',path,body)).status).toBe(400);
    expect((await call(teacherSession,'get',`${path}?fecha=2026-02-30`)).status).toBe(400);
    expect((await call(teacherSession,'get',`${path}?fecha=2099-01-01`)).status).toBe(400);
    expect((await call(teacherSession,'get',`${path}?fecha=2020-01-01`)).status).toBe(403);
    expect((await call(adminSession,'get',`${path}?fecha=2020-01-01`)).status).toBe(200);
    const r=await call(adminSession,'post',path,body,randomUUID());expect(r.status).toBe(201);
    const [stored]=await db.execute('SELECT id_educadora FROM actividades_aula WHERE id_actividad=?',[r.body.data.id_actividad]);expect(stored[0].id_educadora).toBe(admin.id_usuario);
  });
  test('historial de actividades se conserva al recrear aplicación al día siguiente',async()=>{
    const c=await fixture();const [a]=await db.execute('SELECT id_asistencia FROM asistencias WHERE id_menor=?',[c.id]);const path=`/aulas/grupos/${group.id_grupo}/actividades`;
    const created=await call(teacherSession,'post',path,{titulo:'Actividad histórica',participantes:[{id_asistencia:a[0].id_asistencia,observaciones:'Evidencia histórica'}]},randomUUID());expect(created.status).toBe(201);
    const next=new Date(`${today}T14:15:00Z`);next.setUTCDate(next.getUTCDate()+1);const restarted=createApp(db,{...config,clock:()=>next});
    const read=await request(restarted).get(`/api/v1${path}?fecha=${today}`).set('Cookie',teacherSession.cookie);expect(read.status).toBe(200);expect(read.body.data.menores).toEqual([]);expect(read.body.data.actividades.some(r=>r.id_actividad===created.body.data.id_actividad&&r.participantes[0].observaciones==='Evidencia histórica')).toBe(true);
    const [migration]=await db.query("SELECT COUNT(*) n FROM auditoria_eventos WHERE entidad='migraciones' AND entidad_id=4 AND accion='APLICAR'");expect(migration[0].n).toBe(1);
  });
  test('rechaza menor ausente, otra educadora, reposición de educadora y asignación terminada',async()=>{
    const c=await fixture(),absent=await fixture({present:false});
    expect((await call(otherSession,'put','/aulas/insumos/descontar',move(c),randomUUID())).status).toBe(403);
    expect((await call(teacherSession,'put','/aulas/insumos/descontar',move(absent),randomUUID())).status).toBe(403);
    expect((await call(teacherSession,'post','/insumos/movimientos',move(c,{tipo:'ENTRADA'}),randomUUID())).status).toBe(403);
    await db.execute('UPDATE asignaciones_educadoras SET fecha_fin=? WHERE id_usuario=? AND id_grupo=?',[today,teacher.id_usuario,group.id_grupo]);
    expect((await call(teacherSession,'put','/aulas/insumos/descontar',move(c),randomUUID())).status).toBe(403);
    expect((await call(teacherSession,'get',`/aulas/grupos/${group.id_grupo}/insumos`)).status).toBe(403);
  });
});
