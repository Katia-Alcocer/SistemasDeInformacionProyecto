import {describe,test,beforeAll,afterAll,expect} from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {randomBytes} from 'node:crypto';
import {createDatabase} from '../src/config/database.js';
import {createApp} from '../src/app.js';
import {usuariosService} from '../src/modules/usuarios/usuarios.service.js';
import {userSchema} from '../src/modules/usuarios/usuarios.validation.js';
import {groupSchema,updateGroupSchema} from '../src/modules/grupos/grupos.validation.js';
const config={secret:'integration-only-random-secret-with-32-chars',secure:false,origin:'http://localhost:5173'};
describe.skipIf(process.env.RUN_DB_TESTS!=='true')('S1 contra MySQL real aislado',()=>{
  let db,app,admin,adminCookie,csrf,teacher,group;
  const suffix=randomBytes(6).toString('hex');
  const password=randomBytes(18).toString('hex');
  const email=`admin-${suffix}@example.test`;
  beforeAll(async()=>{
    if(process.env.DB_HOST!=='mysql-test')throw new Error('Las pruebas requieren mysql-test');
    db=createDatabase();app=createApp(db,config);
    admin=await usuariosService(db).create(userSchema.parse({nombre:'Administración ficticia',email,password,rol:'ADMIN'}),null);
  },30000);
  afterAll(async()=>{await db?.end();});
  const mutate=(method,path,body)=>request(app)[method](path).set('Cookie',adminCookie).set('X-CSRF-Token',csrf).send(body);
  test('SQL: 41 tablas de referencia + 2 catálogos de comedor y CHECK activo',async()=>{
    const [tables]=await db.query("SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE'");expect(tables[0].n).toBe(43);
    const [defaults]=await db.query("SELECT column_default FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='grupos' AND column_name='activo'");expect(String(defaults[0].COLUMN_DEFAULT||defaults[0].column_default)).toBe('0');
    const [roles]=await db.query('SELECT codigo FROM roles ORDER BY codigo');expect(roles.map(r=>r.codigo)).toEqual(['ADMIN','EDUCADORA','ENFERMERIA','RECEPCION']);
    await expect(db.execute('INSERT INTO usuarios(id_rol,nombre,email,password_hash) VALUES (65535,?,?,?)',['FK ficticia',`fk-${suffix}@example.test`,'no-es-una-clave-real'])).rejects.toHaveProperty('code','ER_NO_REFERENCED_ROW_2');
    await expect(db.query("INSERT INTO grupos(id_categoria,codigo,nombre,capacidad,activo) VALUES (1,?, 'Ficticio',0,0)",[`bad-${suffix}`])).rejects.toHaveProperty('code','ER_CHECK_CONSTRAINT_VIOLATED');
  });
  test('payload estricto y contraseña incorrecta',async()=>{
    expect((await request(app).post('/api/v1/auth/login').send({email,password,rol:'ADMIN'})).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/login').send({email,password:'incorrecta'})).status).toBe(401);
  });
  test('login crea sesión persistida, cookie HttpOnly y JWT de ocho horas',async()=>{
    const response=await request(app).post('/api/v1/auth/login').send({email,password});expect(response.status).toBe(200);
    adminCookie=response.headers['set-cookie'][0].split(';')[0];csrf=response.body.data.csrfToken;
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax');
    expect(JSON.stringify(response.body)).not.toContain('password_hash');
    const claims=jwt.decode(adminCookie.split('=')[1]);expect(claims.exp-claims.iat).toBe(28800);
    const [sessions]=await db.execute('SELECT * FROM sesiones WHERE id_usuario=?',[admin.id_usuario]);expect(sessions.length).toBe(1);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie',adminCookie)).status).toBe(200);
  });
  test('401 sin sesión, JWT expirado/alterado, CSRF y origen inválidos',async()=>{
    expect((await request(app).get('/api/v1/usuarios')).status).toBe(401);
    const token=jwt.sign({},config.secret,{expiresIn:-1,subject:String(admin.id_usuario),jwtid:'expired',issuer:'guarderia',audience:'guarderia-web'});
    expect((await request(app).get('/api/v1/auth/me').set('Cookie',`guarderia_session=${token}`)).status).toBe(401);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie','guarderia_session=invalid')).status).toBe(401);
    expect((await request(app).post('/api/v1/usuarios').set('Cookie',adminCookie).send({})).status).toBe(403);
    expect((await request(app).post('/api/v1/auth/login').set('Origin','https://otro.example').send({email,password})).status).toBe(403);
  });
  test('crear educadora y validar baja lógica/permisos',async()=>{
    const response=await mutate('post','/api/v1/usuarios',{nombre:'Educadora ficticia',email:`teacher-${suffix}@example.test`,password,rol:'EDUCADORA'});expect(response.status).toBe(201);teacher=response.body.data;
    const [stored]=await db.execute('SELECT password_hash FROM usuarios WHERE id_usuario=?',[teacher.id_usuario]);expect(await bcrypt.compare(password,stored[0].password_hash)).toBe(true);
    expect((await mutate('post','/api/v1/usuarios',{nombre:'Duplicado',email:teacher.email,password,rol:'EDUCADORA'})).status).toBe(409);
  });
  test.each(['RECEPCION','EDUCADORA','ENFERMERIA'])('%s recibe 403 en administración',async rol=>{
    const u=await usuariosService(db).create(userSchema.parse({nombre:`Ficticio ${rol}`,email:`${rol}-${suffix}@example.test`,password,rol}),admin.id_usuario);
    const login=await request(app).post('/api/v1/auth/login').send({email:u.email,password});const cookie=login.headers['set-cookie'][0].split(';')[0];
    for(const path of ['/api/v1/usuarios','/api/v1/grupos','/reportes/grupos'])expect((await request(app).get(path).set('Cookie',cookie)).status).toBe(403);
  });
  test('grupo exige responsable activa y capacidad válida',async()=>{
    const base={codigo:`G-${suffix}`,nombre:'Grupo ficticio',id_categoria:1,capacidad:10,activo:true};
    expect((await mutate('post','/api/v1/grupos',base)).status).toBe(422);
    expect((await mutate('post','/api/v1/grupos',{...base,id_responsable:admin.id_usuario})).status).toBe(422);
    expect((await mutate('post','/api/v1/grupos',{...base,capacidad:0})).status).toBe(400);
    const response=await mutate('post','/api/v1/grupos',{...base,id_responsable:teacher.id_usuario});expect(response.status).toBe(201);group=response.body.data;
    expect((await mutate('patch',`/api/v1/usuarios/${teacher.id_usuario}`,{activo:false})).status).toBe(409);
  });
  test('cambios concurrentes conservan una sola responsable e historial',async()=>{
    const responses=await Promise.all([mutate('patch',`/api/v1/grupos/${group.id_grupo}`,{id_responsable:teacher.id_usuario}),mutate('patch',`/api/v1/grupos/${group.id_grupo}`,{id_responsable:teacher.id_usuario})]);expect(responses.map(r=>r.status)).toEqual([200,200]);
    const [rows]=await db.execute('SELECT COUNT(*) n FROM asignaciones_educadoras WHERE id_grupo=? AND fecha_fin IS NULL',[group.id_grupo]);expect(rows[0].n).toBe(1);
    const list=await request(app).get('/api/v1/grupos').set('Cookie',adminCookie);expect(list.body.data.find(g=>g.id_grupo===group.id_grupo).activo).toBe(true);
  });
  test('EJS renderiza datos persistidos y escapa HTML',async()=>{
    await mutate('patch',`/api/v1/grupos/${group.id_grupo}`,{nombre:'<script>alert(1)</script>'});
    const response=await request(app).get('/reportes/grupos').set('Cookie',adminCookie);expect(response.status).toBe(200);expect(response.text).toContain('&lt;script&gt;');expect(response.text).not.toContain('<script>');
  });
  test('desasignar permite baja y revoca sesiones del usuario',async()=>{
    const login=await request(app).post('/api/v1/auth/login').send({email:teacher.email,password});const cookie=login.headers['set-cookie'][0].split(';')[0];
    expect((await mutate('patch',`/api/v1/grupos/${group.id_grupo}`,{activo:false,id_responsable:null})).status).toBe(200);
    expect((await mutate('patch',`/api/v1/usuarios/${teacher.id_usuario}`,{activo:false})).status).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie',cookie)).status).toBe(401);
    const [rows]=await db.execute('SELECT deleted_at FROM usuarios WHERE id_usuario=?',[teacher.id_usuario]);expect(rows[0].deleted_at).not.toBeNull();
  });
  test('auditoría transaccional y permisos SQL limitados',async()=>{
    const [events]=await db.execute("SELECT detalle FROM auditoria_eventos WHERE entidad='grupos' AND entidad_id=?",[group.id_grupo]);expect(events.length).toBeGreaterThan(1);
    await expect(db.query('DELETE FROM usuarios WHERE id_usuario=0')).rejects.toHaveProperty('code','ER_TABLEACCESS_DENIED_ERROR');
    await expect(db.query('UPDATE auditoria_eventos SET accion=accion WHERE id_evento=0')).rejects.toHaveProperty('code','ER_TABLEACCESS_DENIED_ERROR');
  });
  test('logout revoca JWT y borra cookie',async()=>{
    expect((await mutate('post','/api/v1/auth/logout',{})).status).toBe(204);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie',adminCookie)).status).toBe(401);
  });
  test('dos bajas concurrentes no eliminan al último ADMIN',async()=>{
    const service=usuariosService(db);
    const second=await service.create(userSchema.parse({nombre:'Segundo ADMIN ficticio',email:`second-${suffix}@example.test`,password,rol:'ADMIN'}),admin.id_usuario);
    await db.execute("UPDATE usuarios u JOIN roles r USING(id_rol) SET u.activo=0 WHERE r.codigo='ADMIN' AND u.id_usuario NOT IN (?,?)",[admin.id_usuario,second.id_usuario]);
    const results=await Promise.allSettled([service.update(admin.id_usuario,{activo:false},admin.id_usuario),service.update(second.id_usuario,{activo:false},second.id_usuario)]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(results.find(r=>r.status==='rejected').reason.code).toBe('LAST_ADMIN');
  });
  test('cookie Secure en HTTPS y límite de intentos de login',async()=>{
    const secureApp=createApp(db,{...config,secure:true});
    const [admins]=await db.query("SELECT u.email FROM usuarios u JOIN roles r USING(id_rol) WHERE r.codigo='ADMIN' AND u.activo=1");
    const response=await request(secureApp).post('/api/v1/auth/login').send({email:admins[0].email,password});expect(response.status).toBe(200);expect(response.headers['set-cookie'][0]).toContain('Secure');
    let last;
    for(let i=0;i<11;i++)last=await request(secureApp).post('/api/v1/auth/login').send({email,password:'wrong'});
    expect(last.status).toBe(429);
  });
});
test('PATCH conserva campos omitidos sin aplicar defaults',()=>{expect(updateGroupSchema.parse({nombre:'Nuevo'})).toEqual({nombre:'Nuevo'});expect(groupSchema.parse({codigo:'A',nombre:'Aula',id_categoria:1,capacidad:1}).activo).toBe(false);});
