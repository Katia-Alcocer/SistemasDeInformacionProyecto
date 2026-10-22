import {describe,test,beforeAll,afterAll,expect} from 'vitest';
import request from 'supertest';
import {randomBytes} from 'node:crypto';
import {createDatabase} from '../src/config/database.js';
import {createApp} from '../src/app.js';
import {usuariosService} from '../src/modules/usuarios/usuarios.service.js';
import {userSchema} from '../src/modules/usuarios/usuarios.validation.js';
import {gruposService} from '../src/modules/grupos/grupos.service.js';
import {civilDate} from '../src/utils/transaction.js';
import {addMonths} from '../src/utils/dates.js';
import {operationalTime} from '../src/utils/clock.js';
test('reloj convierte UTC a fecha civil y no usa hora del navegador',()=>{expect(operationalTime(new Date('2026-10-22T05:59:00Z'),'America/Mexico_City')).toEqual({date:'2026-10-21',time:'23:59:00',utc:'2026-10-22 05:59:00'});});
describe.skipIf(process.env.RUN_DB_TESTS!=='true')('S3: recepción transaccional con MySQL real y reloj controlado',()=>{
  let db,app,cookie,csrf,admin,teacher,group,sequence=0;
  const suffix=randomBytes(5).toString('hex'),password=randomBytes(18).toString('hex'),today=civilDate();
  let instant=`${today}T14:15:00Z`;
  const config={secret:'s3-private-test-secret-at-least-32-chars',secure:false,origin:'http://localhost:5173',documentKey:randomBytes(32).toString('hex'),uploadDir:`/tmp/s3-${suffix}`,clock:()=>new Date(instant)};
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
  const send=(method,path,data)=>request(app)[method](path).set('Cookie',cookie).set('X-CSRF-Token',csrf).send(data);
  const dayShift=(n)=>{const d=new Date(`${today}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  async function child(options={}){
    // Fixtures exclusivamente en mysql-test. Las altas/documentos de S2 se
    // prueban por sus endpoints en s2.integration.test.js, no en desarrollo.
    const code=`S3-${suffix}-${++sequence}`,birth=options.birth||addMonths(today,-6);
    const [r]=await db.execute("INSERT INTO menores(codigo,nombres,apellido_paterno,fecha_nacimiento,curp,estatus,registro_civil_validado,requerimientos_insumos_revisados) VALUES (?,'Menor ficticio','Prueba',?,?,?,1,?)",[code,birth,randomBytes(9).toString('hex').toUpperCase(),options.status||'ACTIVO',options.reviewed===false?0:1]);
    await db.execute('INSERT INTO historial_grupos(id_menor,id_grupo,fecha_inicio) VALUES (?,?,?)',[r.insertId,group.id_grupo,today]);
    for(const type of ['ACTA_NACIMIENTO','CURP'])await db.execute("INSERT INTO documentos_menor(id_menor,tipo,ruta_segura,validado) VALUES (?,?,'fixture-civil-no-publicado',1)",[r.insertId,type]);
    return {id:r.insertId,code,birth};
  }
  const payload=(c,extra={})=>({id_menor:c.id,sintomas:false,indicio_contagio:false,pendiente_relevante:false,requiere_tratamiento:false,dieta_temporal_requerida:false,nombre_acompanante:'Acompañante ficticio',parentesco_acompanante:'Familiar',inspeccion:{confirmada:true,area:'CUNERO',lesiones:[]},...extra});
  const intake=(c,extra={})=>send('post','/api/v1/recepcion/ingreso',payload(c,extra));
  async function medical(c,extra={}){
    const upload=await request(app).post(`/api/v1/recetas/documentos/${c.id}`).set('Cookie',cookie).set('X-CSRF-Token',csrf).set('Content-Type','application/pdf').send(pdf);expect(upload.status).toBe(201);
    const body={id_menor:c.id,id_documento:upload.body.data.id_documento,nombre_medico:'Profesional ficticio',cedula_profesional:'TEST-12345',fecha_consulta:today,vigencia_inicio:today,vigencia_fin:dayShift(2),permite_convivencia:true,confirmacion_revision:true,confirmacion_prescripcion:true,tratamientos:[],restricciones:[],...extra};
    const r=await send('post','/api/v1/recetas',body);expect(r.status).toBe(201);return {recipe:r.body.data,documentId:body.id_documento};
  }
  beforeAll(async()=>{
    if(process.env.DB_HOST!=='mysql-test')throw new Error('Se requiere mysql-test');db=createDatabase();app=createApp(db,config);
    admin=await usuariosService(db).create(userSchema.parse({nombre:'ADMIN ficticio S3',email:`s3-${suffix}@example.test`,password,rol:'ADMIN'}),null);
    teacher=await usuariosService(db).create(userSchema.parse({nombre:'Educadora ficticia S3',email:`s3teacher-${suffix}@example.test`,password,rol:'EDUCADORA'}),admin.id_usuario);
    group=await gruposService(db).create({codigo:`S3-${suffix}`,nombre:'Grupo ficticio S3',id_categoria:1,capacidad:100,activo:true,id_responsable:teacher.id_usuario},admin.id_usuario);
    const r=await request(app).post('/api/v1/auth/login').send({email:admin.email,password});cookie=r.headers['set-cookie'][0].split(';')[0];csrf=r.body.data.csrfToken;
  });
  afterAll(async()=>{await db?.end();});
  test.each([['13:59:00',422],['14:00:00',201],['14:15:00',201],['15:00:00',422],['15:01:00',422]])('hora UTC %s devuelve %s y conserva intento',async(time,status)=>{
    instant=`${today}T${time}Z`;const c=await child();const r=await intake(c,{hora_ingreso:'08:15:00',nombre_acompanante:null,parentesco_acompanante:null});expect(r.status).toBe(status);
    const [attempts]=await db.execute('SELECT resultado,motivo_rechazo FROM intentos_ingreso WHERE id_menor=?',[c.id]);expect(attempts).toHaveLength(1);expect(attempts[0].resultado).toBe(status===201?'ACEPTADO':'RECHAZADO');
    const [attendance]=await db.execute('SELECT id_asistencia FROM asistencias WHERE id_menor=?',[c.id]);expect(attendance).toHaveLength(status===201?1:0);
    if(status===422)expect(attempts[0].motivo_rechazo).toContain('FUERA_DE_HORARIO');
    instant=`${today}T14:15:00Z`;
  });
  test('29 días/cuarto cumpleaños rechazados, 30 días aceptados',async()=>{
    for(const [birth,status] of [[dayShift(-29),422],[dayShift(-30),201],[addMonths(today,-48),422]]){const c=await child({birth});const r=await intake(c);expect(r.status).toBe(status);if(status===422)expect(r.body.data.motivos.some(m=>m.codigo==='EDAD_NO_ADMISIBLE')).toBe(true);}
  });
  test('baja, revisión civil, inspección y requisitos no revisados impiden asistencia',async()=>{
    for(const options of [{status:'BAJA'},{reviewed:false}]){const c=await child(options);expect((await intake(c)).status).toBe(422);}
    const c=await child();await db.execute('UPDATE menores SET registro_civil_validado=0 WHERE id_menor=?',[c.id]);expect((await intake(c)).body.data.motivos.some(m=>m.codigo==='EXPEDIENTE_INCOMPLETO')).toBe(true);
    const d=await child();expect((await intake(d,{inspeccion:{confirmada:false,area:'GENERAL',lesiones:[]}})).status).toBe(422);
  });
  test('dos ingresos simultáneos generan una sola asistencia y dos intentos',async()=>{
    const c=await child();const r=await Promise.all([intake(c),intake(c)]);expect(r.map(x=>x.status).sort()).toEqual([201,422]);
    const [a]=await db.execute('SELECT COUNT(*) n FROM asistencias WHERE id_menor=?',[c.id]);const [t]=await db.execute('SELECT COUNT(*) n FROM intentos_ingreso WHERE id_menor=?',[c.id]);expect(a[0].n).toBe(1);expect(t[0].n).toBe(2);
  });
  test('síntomas sin receta y contagio incompatible conservan motivo',async()=>{
    const c=await child();const r=await intake(c,{sintomas:true});expect(r.status).toBe(422);expect(r.body.data.motivos.some(m=>m.codigo==='RECETA_CONVIVENCIA_REQUERIDA')).toBe(true);
    const d=await child();await medical(d);expect((await intake(d,{sintomas:true,indicio_contagio:true})).body.data.motivos.some(m=>m.codigo==='CONVIVENCIA_INCOMPATIBLE')).toBe(true);
    const e=await child();await medical(e,{permite_convivencia:false});expect((await intake(e)).status).toBe(422);
  });
  test('prescripción estricta y dosificador graduado; cuchara no cumple',async()=>{
    const c=await child();const t={medicamento:'Sustancia ficticia prescrita',dosis:1.5,unidad:'ml',via:'ORAL',fecha_inicio:today,fecha_fin:dayShift(1),dosificador_requerido:true,horarios:['08:30','12:00']};
    const {recipe,documentId}=await medical(c,{tratamientos:[t]});expect((await intake(c,{sintomas:true})).body.data.motivos.some(m=>m.codigo==='DOSIFICADOR_FALTANTE')).toBe(true);
    const id=recipe.tratamientos[0].id_tratamiento;
    expect((await send('patch',`/api/v1/recetas/tratamientos/${id}/dosificador`,{entregado:true,tipo:'NO_GRADUADO'})).status).toBe(422);
    expect((await send('patch',`/api/v1/recetas/tratamientos/${id}/dosificador`,{entregado:true,tipo:'GRADUADO'})).status).toBe(200);
    expect((await intake(c,{sintomas:true,requiere_tratamiento:true})).status).toBe(201);
    const base={id_menor:c.id,id_documento:documentId,nombre_medico:'Ficticio',cedula_profesional:'TEST',fecha_consulta:today,vigencia_inicio:today,vigencia_fin:dayShift(2),permite_convivencia:true,confirmacion_revision:true,confirmacion_prescripcion:true};
    for(const bad of [{...t,dosis:0},{...t,dosificador_requerido:false},{...t,horarios:['08:30','08:30']},{...t,fecha_fin:dayShift(3)}])expect((await send('post','/api/v1/recetas',{...base,tratamientos:[bad]})).status).toBe(400);
  });
  test('lesiones requieren acompañante y seguimiento del mismo menor',async()=>{
    const c=await child();const injury={ubicacion:'Brazo ficticio',descripcion:'Lesión ficticia de prueba',causa_reportada:'Declaración ficticia',estado:'ABIERTA'};
    expect((await intake(c,{nombre_acompanante:null,parentesco_acompanante:null,inspeccion:{confirmada:true,area:'CUNERO',lesiones:[injury]}})).status).toBe(400);
    instant=`${today}T13:59:00Z`;const first=await intake(c,{inspeccion:{confirmada:true,area:'CUNERO',lesiones:[injury]}});expect(first.status).toBe(422);instant=`${today}T14:15:00Z`;
    const ficha=await request(app).get(`/api/v1/recepcion/menor/${c.code}`).set('Cookie',cookie);const prior=ficha.body.data.lesiones_previas[0];expect(prior).toBeTruthy();
    expect((await intake(c)).body.data.motivos.some(m=>m.codigo==='SEGUIMIENTO_PENDIENTE')).toBe(true);
    const other=await child();expect((await intake(other,{inspeccion:{confirmada:true,area:'CUNERO',lesiones:[{...injury,id_lesion_anterior:prior.id_lesion}]}})).body.data.motivos.some(m=>m.codigo==='SEGUIMIENTO_INVALIDO')).toBe(true);
    expect((await intake(c,{inspeccion:{confirmada:true,area:'CUNERO',lesiones:[{...injury,id_lesion_anterior:prior.id_lesion,estado:'RESUELTA'}]}})).status).toBe(201);
  });
  test('mínimo obligatorio, reposición idempotente y reintento dentro de horario',async()=>{
    const c=await child({reviewed:false});expect((await send('put',`/api/v1/insumos/menor/${c.id}/requerimientos`,{requerimientos:[{id_tipo_insumo:1,cantidad_requerida_ingreso:2,obligatorio:true}]})).status).toBe(200);
    expect((await intake(c)).body.data.motivos.some(m=>m.codigo==='INSUMO_INSUFICIENTE')).toBe(true);
    const stock=await request(app).get(`/api/v1/insumos/menor/${c.id}`).set('Cookie',cookie);const id=stock.body.data.insumos[0].id_insumo_menor,key=`entry-${suffix}`;
    const body={id_insumo_menor:id,tipo:'ENTRADA',cantidad:2,motivo:'Reposición ficticia'};
    const first=await send('post','/api/v1/insumos/movimientos',body).set('Idempotency-Key',key);expect(first.status).toBe(201);
    const second=await send('post','/api/v1/insumos/movimientos',body).set('Idempotency-Key',key);expect(second.body.data.repetido).toBe(true);
    expect((await send('post','/api/v1/insumos/movimientos',{...body,cantidad:3}).set('Idempotency-Key',key)).status).toBe(409);
    expect((await intake(c)).status).toBe(201);
    const [rows]=await db.execute('SELECT cantidad_actual FROM insumos_menor WHERE id_insumo_menor=?',[id]);expect(rows[0].cantidad_actual).toBe('2.000');
  });
  test('dietas vencidas no vigentes y alergias basales independientes',async()=>{
    const c=await child();await medical(c,{fecha_consulta:dayShift(-2),vigencia_inicio:dayShift(-2),restricciones:[{tipo:'DIETA_MEDICA_TEMPORAL',descripcion:'Dieta ficticia',inicio:dayShift(-2),fin:dayShift(-1)}]});
    expect((await intake(c,{dieta_temporal_requerida:true})).status).toBe(422);
    await send('post','/api/v1/recetas/restricciones-base',{id_menor:c.id,descripcion:'Alergia basal ficticia',inicio:dayShift(-30)});
    const r=await request(app).get(`/api/v1/recepcion/menor/${c.id}?tipo=ID`).set('Cookie',cookie);expect(r.status).toBe(200);expect(r.body.data.restricciones.map(d=>d.tipo)).toEqual(['ALERGIA_BASE']);expect(JSON.stringify(r.body)).not.toContain('ruta_segura');
  });
  test('documentos médicos no permiten usar identificaciones o actas ajenas',async()=>{
    const c=await child(),other=await child();const {documentId}=await medical(c);
    const body={id_menor:other.id,id_documento:documentId,nombre_medico:'Ficticio',cedula_profesional:'TEST',fecha_consulta:today,vigencia_inicio:today,vigencia_fin:today,permite_convivencia:true,confirmacion_revision:true,confirmacion_prescripcion:true};
    expect((await send('post','/api/v1/recetas',body)).status).toBe(422);
    const [civil]=await db.execute("SELECT id_documento FROM documentos_menor WHERE id_menor=? AND uso='EXPEDIENTE' LIMIT 1",[c.id]);
    expect((await request(app).get(`/api/v1/recetas/documentos/${c.id}/${civil[0].id_documento}`).set('Cookie',cookie)).status).toBe(404);
  });
  test('permisos separan recepción de enfermería',async()=>{
    for(const rol of ['RECEPCION','ENFERMERIA']){
      const u=await usuariosService(db).create(userSchema.parse({nombre:`Ficticio S3 ${rol}`,email:`s3-${rol}-${suffix}@example.test`,password,rol}),admin.id_usuario);
      const login=await request(app).post('/api/v1/auth/login').send({email:u.email,password});const token=login.headers['set-cookie'][0].split(';')[0],xsrf=login.body.data.csrfToken;
      if(rol==='RECEPCION')expect((await request(app).post('/api/v1/recetas').set('Cookie',token).set('X-CSRF-Token',xsrf).send({})).status).toBe(403);
      else {expect((await request(app).get('/api/v1/recetas/menores').set('Cookie',token)).status).toBe(200);expect((await request(app).post('/api/v1/recepcion/ingreso').set('Cookie',token).set('X-CSRF-Token',xsrf).send({})).status).toBe(403);}
    }
  });
});
