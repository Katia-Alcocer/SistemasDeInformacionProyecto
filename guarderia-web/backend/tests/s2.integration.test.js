import {describe,test,beforeAll,afterAll,expect} from 'vitest';
import request from 'supertest';
import {randomBytes} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createDatabase} from '../src/config/database.js';
import {createApp} from '../src/app.js';
import {usuariosService} from '../src/modules/usuarios/usuarios.service.js';
import {userSchema} from '../src/modules/usuarios/usuarios.validation.js';
import {gruposService} from '../src/modules/grupos/grupos.service.js';
import {ageCategory,addMonths,validDate} from '../src/utils/dates.js';
import {civilDate} from '../src/utils/transaction.js';
test('fechas civiles, 29/30 días, cumpleaños y años bisiestos',()=>{
  expect(validDate('2025-02-29')).toBe(false);expect(validDate('2024-02-29')).toBe(true);
  expect(ageCategory('2026-01-01','2026-01-30')).toBeNull();expect(ageCategory('2026-01-01','2026-01-31')).toBe('G0');
  expect(ageCategory('2022-10-20','2026-10-19')).toBe('G3');expect(ageCategory('2022-10-20','2026-10-20')).toBeNull();
  expect(ageCategory('2024-02-29','2025-02-28')).toBe('G1');expect(addMonths('2026-10-31',4)).toBe('2027-02-28');
});
describe.skipIf(process.env.RUN_DB_TESTS!=='true')('S2: admisión y archivos privados con MySQL real',()=>{
  let db,app,cookie,csrf,admin,teacher,group,child,pre,document,people=[];
  const suffix=randomBytes(5).toString('hex'),password=randomBytes(18).toString('hex');
  const config={secret:'s2-test-secret-with-more-than-32-chars',secure:false,origin:'http://localhost:5173',documentKey:randomBytes(32).toString('hex'),uploadDir:`/tmp/s2-${suffix}`};
  const today=civilDate(),birth=addMonths(today,-6);
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
  const curpPrefixes=new Map();
  const payload=(code,date=birth)=>{if(!curpPrefixes.has(code))curpPrefixes.set(code,`${String.fromCharCode(65+parseInt(suffix.slice(0,2),16)%26)}${'AEIOU'[parseInt(suffix.slice(2,4),16)%5]}${String.fromCharCode(65+curpPrefixes.size)}${String.fromCharCode(65+parseInt(suffix.slice(4,6),16)%26)}`);return {codigo:`${code}-${suffix}`,nombres:'Menor ficticio',apellido_paterno:'Prueba',fecha_nacimiento:date,curp:`${curpPrefixes.get(code)}${date.replaceAll('-','').slice(2)}HDFXXX${suffix[6].toUpperCase()}${parseInt(suffix[7],16)%10}`};};
  const send=(method,path,data)=>request(app)[method](path).set('Cookie',cookie).set('X-CSRF-Token',csrf).send(data);
  const upload=(id,type,data=pdf,mime='application/pdf')=>request(app).post(`/api/v1/admin/menores/${id}/documentos`).set('Cookie',cookie).set('X-CSRF-Token',csrf).set('X-Document-Type',type).set('Content-Type',mime).send(data);
  async function ready(id){for(const type of ['ACTA_NACIMIENTO','CURP']){const up=await upload(id,type);expect(up.status).toBe(201);expect((await send('patch',`/api/v1/admin/menores/${id}/documentos/${up.body.data.id_documento}`,{validado:true})).status).toBe(200);}expect((await send('post',`/api/v1/admin/menores/${id}/registro-civil`,{confirmacion:true})).status).toBe(200);}
  beforeAll(async()=>{
    if(process.env.DB_HOST!=='mysql-test')throw new Error('Solo mysql-test');db=createDatabase();app=createApp(db,config);
    admin=await usuariosService(db).create(userSchema.parse({nombre:'ADMIN ficticio S2',email:`s2-${suffix}@example.test`,password,rol:'ADMIN'}),null);
    teacher=await usuariosService(db).create(userSchema.parse({nombre:'Educadora ficticia S2',email:`s2teacher-${suffix}@example.test`,password,rol:'EDUCADORA'}),admin.id_usuario);
    group=await gruposService(db).create({codigo:`S2-${suffix}`,nombre:'Grupo ficticio',id_categoria:1,capacidad:5,activo:true,id_responsable:teacher.id_usuario},admin.id_usuario);
    const login=await request(app).post('/api/v1/auth/login').send({email:admin.email,password});cookie=login.headers['set-cookie'][0].split(';')[0];csrf=login.body.data.csrfToken;
  });
  afterAll(async()=>{await db?.end();});
  test('preinscripción en ventana, estados y rechazo de intervalo inválido',async()=>{
    const data={nombre_contacto:'Contacto ficticio',telefono_contacto:'5550000000',fecha_probable_parto:addMonths(today,2)};
    const r=await send('post','/api/v1/preinscripciones',data);expect(r.status).toBe(201);pre=r.body.data;
    expect((await send('post','/api/v1/preinscripciones',{...data,fecha_probable_parto:addMonths(today,5)})).status).toBe(422);
    expect((await send('patch',`/api/v1/preinscripciones/${pre.id_preinscripcion}`,{estado:'CONFIRMADA'})).status).toBe(200);
  });
  test('expediente pendiente, fecha inválida y datos privados no expuestos',async()=>{
    expect((await send('post','/api/v1/admin/menores',{...payload('BAD'),fecha_nacimiento:'2026-02-30'})).status).toBe(400);
    const r=await send('post','/api/v1/admin/menores',{...payload('MAIN'),id_preinscripcion:pre.id_preinscripcion});expect(r.status).toBe(201);child=r.body.data;expect(child.estatus).toBe('PENDIENTE');expect(child.registro_civil_validado).toBe(false);expect(child.curp).not.toBe(payload('MAIN').curp);
    expect((await send('post',`/api/v1/admin/menores/${child.id_menor}/activar`,{id_grupo:group.id_grupo})).status).toBe(422);
    expect((await send('patch',`/api/v1/preinscripciones/${pre.id_preinscripcion}`,{estado:'CANCELADA'})).status).toBe(409);
  });
  test('documentos rechazan MIME falso, vacío, contenido activo y exceso de tamaño',async()=>{
    expect((await upload(child.id_menor,'ACTA_NACIMIENTO',pdf,'image/png')).status).toBe(422);
    expect((await upload(child.id_menor,'ACTA_NACIMIENTO',Buffer.from('archivo inválido'))).status).toBe(422);
    expect((await upload(child.id_menor,'ACTA_NACIMIENTO',Buffer.from('%PDF-1.4 /JavaScript %%EOF'))).status).toBe(422);
    expect((await upload(child.id_menor,'ACTA_NACIMIENTO',Buffer.alloc(2*1024*1024+1))).status).toBe(413);
  });
  test('cifrado, validación manual, descarga autorizada y ausencia de rutas privadas',async()=>{
    const r=await upload(child.id_menor,'OTRO');expect(r.status).toBe(201);document=r.body.data;
    const [rows]=await db.execute('SELECT ruta_segura FROM documentos_menor WHERE id_documento=?',[document.id_documento]);const encrypted=await readFile(join(config.uploadDir,rows[0].ruta_segura));expect(encrypted.includes(Buffer.from('%PDF-'))).toBe(false);
    const downloaded=await request(app).get(`/api/v1/admin/menores/${child.id_menor}/documentos/${document.id_documento}`).set('Cookie',cookie);expect(downloaded.status).toBe(200);expect(downloaded.body.equals(pdf)).toBe(true);
    expect((await send('patch',`/api/v1/admin/menores/${child.id_menor}/documentos/${document.id_documento}`,{validado:true})).status).toBe(200);
    const details=await request(app).get(`/api/v1/admin/menores/${child.id_menor}`).set('Cookie',cookie);expect(JSON.stringify(details.body)).not.toContain('ruta_segura');expect(JSON.stringify(details.body)).not.toContain('hash_sha256');
  });
  test('activación solo tras acta, CURP y Registro Civil; historial conservado',async()=>{
    await ready(child.id_menor);
    const r=await send('post',`/api/v1/admin/menores/${child.id_menor}/activar`,{id_grupo:group.id_grupo});expect(r.status).toBe(200);expect(r.body.data.estatus).toBe('ACTIVO');
    expect((await send('patch',`/api/v1/admin/menores/${child.id_menor}`,{nombres:'Cambio activo'})).status).toBe(409);
    const details=await request(app).get(`/api/v1/admin/menores/${child.id_menor}`).set('Cookie',cookie);expect(details.body.data.historial_grupos).toHaveLength(1);
    expect((await send('patch',`/api/v1/grupos/${group.id_grupo}`,{activo:false})).status).toBe(409);
  });
  test('activar a los 29 días o en el cuarto cumpleaños se rechaza',async()=>{
    const twentyNine=new Date(`${today}T00:00:00Z`);twentyNine.setUTCDate(twentyNine.getUTCDate()-29);
    for(const [code,date] of [['YOUNG',twentyNine.toISOString().slice(0,10)],['FOUR',addMonths(today,-48)]]){const r=await send('post','/api/v1/admin/menores',payload(code,date));expect(r.status).toBe(201);expect((await send('post',`/api/v1/admin/menores/${r.body.data.id_menor}/activar`,{id_grupo:group.id_grupo})).status).toBe(422);}
  });
  test('documentos de otro menor no se pueden descargar por un vínculo ajeno',async()=>{
    const r=await send('post','/api/v1/admin/menores',payload('DOCOWNER'));expect(r.status).toBe(201);
    expect((await request(app).get(`/api/v1/admin/menores/${r.body.data.id_menor}/documentos/${document.id_documento}`).set('Cookie',cookie)).status).toBe(404);
  });
  test('personas reutilizables y no más de tres auxiliares aun con concurrencia',async()=>{
    for(let i=0;i<4;i++){const r=await send('post','/api/v1/personas',{nombre:`Persona ficticia ${i}`,telefono:'5550000000',tipo_identificacion:'INE'});expect(r.status).toBe(201);people.push(r.body.data);}
    const link=p=>({id_persona:p.id_persona,tipo:'AUXILIAR',parentesco:'Familiar',fecha_fin:addMonths(today,1)});
    for(let i=0;i<2;i++)expect((await send('post',`/api/v1/menores/${child.id_menor}/autorizados`,link(people[i]))).status).toBe(201);
    const r=await Promise.all(people.slice(2).map(p=>send('post',`/api/v1/menores/${child.id_menor}/autorizados`,link(p))));expect(r.map(v=>v.status).sort()).toEqual([201,422]);
    const other=await send('post','/api/v1/admin/menores',payload('OTHER'));expect((await send('post',`/api/v1/menores/${other.body.data.id_menor}/autorizados`,{...link(people[0]),tipo:'PRINCIPAL'})).status).toBe(201);
    const list=await request(app).get(`/api/v1/menores/${child.id_menor}/autorizados`).set('Cookie',cookie);expect(list.body.data.autorizados.filter(v=>!v.fecha_fin||v.fecha_fin>today)).toHaveLength(3);
    const first=list.body.data.autorizados[0];expect(first.vigente).toBe(true);
    expect((await send('patch',`/api/v1/menores/${child.id_menor}/autorizados/${first.id_vinculo}`,{vigente:false})).status).toBe(200);
    expect((await send('post',`/api/v1/menores/${child.id_menor}/autorizados`,{...link(people[0]),fecha_fin:today})).status).toBe(422);
    expect((await send('post',`/api/v1/menores/${child.id_menor}/autorizados`,link(people[0]))).status).toBe(201);
  });
  test('restricción judicial exige respaldo y prohíbe recoger; documento del mismo menor',async()=>{
    const data={id_persona:people[3].id_persona,tipo:'PRINCIPAL',parentesco:'Familiar',restriccion_judicial:true,puede_recoger:true,id_documento_restriccion:document.id_documento};
    expect((await send('post',`/api/v1/menores/${child.id_menor}/autorizados`,data)).status).toBe(422);
    expect((await send('post',`/api/v1/menores/${child.id_menor}/autorizados`,{...data,puede_recoger:false,id_documento_restriccion:null})).status).toBe(422);
  });
  test('editar persona reutilizable valida datos y conserva vínculo',async()=>{
    const r=await send('patch',`/api/v1/personas/${people[0].id_persona}`,{telefono:'5551112222'});expect(r.status).toBe(200);expect(r.body.data.telefono).toBe('5551112222');
    expect((await send('patch',`/api/v1/personas/${people[0].id_persona}`,{telefono:'INVALIDO'})).status).toBe(400);
    const links=await request(app).get(`/api/v1/menores/${child.id_menor}/autorizados`).set('Cookie',cookie);expect(links.body.data.autorizados.find(v=>v.id_persona===people[0].id_persona).telefono).toBe('5551112222');
  });
  test('gafetes: códigos una sola vez, máximo tres y revocación',async()=>{
    let first;for(let i=0;i<3;i++){const r=await send('post',`/api/v1/menores/${child.id_menor}/gafetes`,{});expect(r.status).toBe(201);expect(r.body.data.codigo).toHaveLength(48);expect(r.body.data.codigo_hash).toBeUndefined();first||=r.body.data;}
    expect((await send('post',`/api/v1/menores/${child.id_menor}/gafetes`,{})).status).toBe(422);
    expect((await send('patch',`/api/v1/menores/${child.id_menor}/gafetes/${first.id_gafete}`,{estado:'REVOCADO'})).status).toBe(200);
    const list=await request(app).get(`/api/v1/menores/${child.id_menor}/autorizados`).set('Cookie',cookie);expect(JSON.stringify(list.body)).not.toContain('codigo_hash');expect(JSON.stringify(list.body)).not.toContain(first.codigo);
  });
  test('RECEPCION lee ficha/vínculos pero no documentos ni activación',async()=>{
    const user=await usuariosService(db).create(userSchema.parse({nombre:'Recepción S2',email:`s2rec-${suffix}@example.test`,password,rol:'RECEPCION'}),admin.id_usuario);
    const r=await request(app).post('/api/v1/auth/login').send({email:user.email,password});const rc=r.headers['set-cookie'][0].split(';')[0];
    expect((await request(app).get(`/api/v1/admin/menores/${child.id_menor}`).set('Cookie',rc)).status).toBe(200);
    expect((await request(app).get(`/api/v1/menores/${child.id_menor}/autorizados`).set('Cookie',rc)).status).toBe(200);
    expect((await request(app).get(`/api/v1/admin/menores/${child.id_menor}/documentos/${document.id_documento}`).set('Cookie',rc)).status).toBe(403);
  });
  test('concurrencia no rebasa cupo y categoría de grupo se valida por cumpleaños',async()=>{
    const g=await gruposService(db).create({codigo:`C-${suffix}`,nombre:'Cupo uno',id_categoria:1,capacidad:1,activo:true,id_responsable:teacher.id_usuario},admin.id_usuario);
    const ids=[];for(const code of ['CAP1','CAP2']){const c=await send('post','/api/v1/admin/menores',payload(code));ids.push(c.body.data.id_menor);await ready(c.body.data.id_menor);}
    const r=await Promise.all(ids.map(id=>send('post',`/api/v1/admin/menores/${id}/activar`,{id_grupo:g.id_grupo})));expect(r.map(v=>v.status).sort()).toEqual([200,409]);
    const g1=await gruposService(db).create({codigo:`AGE-${suffix}`,nombre:'Un año',id_categoria:2,capacidad:2,activo:true,id_responsable:teacher.id_usuario},admin.id_usuario);
    expect((await send('post',`/api/v1/admin/menores/${child.id_menor}/activar`,{id_grupo:g1.id_grupo})).status).toBe(422);
  });
  test('baja conserva historial y documentos; reabrir no activa automáticamente',async()=>{
    expect((await send('post',`/api/v1/admin/menores/${child.id_menor}/estado`,{estatus:'BAJA',motivo:'Baja ficticia por prueba'})).status).toBe(200);
    expect((await send('post',`/api/v1/admin/menores/${child.id_menor}/activar`,{id_grupo:group.id_grupo})).status).toBe(409);
    const d=await request(app).get(`/api/v1/admin/menores/${child.id_menor}`).set('Cookie',cookie);expect(d.body.data.historial_grupos.length).toBeGreaterThan(0);expect(d.body.data.documentos.length).toBeGreaterThan(0);
  });
  test('identificación privada y rechazo de archivo cifrado alterado',async()=>{
    const p=people[0];const r=await request(app).post(`/api/v1/personas/${p.id_persona}/identificacion`).set('Cookie',cookie).set('X-CSRF-Token',csrf).set('Content-Type','application/pdf').send(pdf);expect(r.status).toBe(201);
    expect((await request(app).get(`/api/v1/personas/${p.id_persona}/identificacion`).set('Cookie',cookie)).status).toBe(200);
    const [rows]=await db.execute('SELECT ruta_segura FROM documentos_menor WHERE id_documento=?',[document.id_documento]);const path=join(config.uploadDir,rows[0].ruta_segura);const bytes=await readFile(path);bytes[30]^=255;await writeFile(path,bytes);
    expect((await request(app).get(`/api/v1/admin/menores/${child.id_menor}/documentos/${document.id_documento}`).set('Cookie',cookie)).status).toBe(500);
  });
});
