// Login, consultas y logout; medicamentos sincroniza pendientes y auditoría.
const base='http://frontend:5173';
const response=await fetch(`${base}/api/v1/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})});
if(response.status!==200)throw new Error(`Login HTTP ${response.status}`);
const cookie=response.headers.getSetCookie()[0].split(';')[0];
const {data}=await response.json();
let sampleChild=null;
let sampleGroup=null;
const delays=await fetch(`${base}/api/v1/retardos`,{headers:{Cookie:cookie}});
if(delays.status!==200||!Array.isArray((await delays.json()).data.asistencias))throw new Error('Avisos de retardo no disponibles');
const spec=await fetch(`${base}/api/v1/openapi.json`);
if(!spec.ok||!(await spec.json()).paths['/retardos/{id}/aviso']?.put)throw new Error('Contrato de avisos no disponible');
console.info('Avisos de retardo y contrato OpenAPI: 200');
const reviews=await fetch(`${base}/api/v1/retardos/revisiones`,{headers:{Cookie:cookie}});
if(reviews.status!==200||(await reviews.json()).data.criterio!=='PERSONA_RECEPTORA')throw new Error('Revisiones y contador anual no disponibles');
console.info('Revisiones de retardos y contador por receptor: 200');
const authority=await fetch(`${base}/api/v1/autoridad`,{headers:{Cookie:cookie}});
if(authority.status!==200)throw new Error('Reportes de autoridad no disponibles');
const reports=(await authority.json()).data.reportes;
if(!Array.isArray(reports))throw new Error('Listado de autoridad inválido');
const printable=reports.find(r=>r.contenido)?.id_reporte;
if(printable){const document=await fetch(`${base}/reportes/autoridad/${printable}`,{headers:{Cookie:cookie}});if(!document.ok||!(await document.text()).includes('No acredita envío oficial'))throw new Error('Documento interno no disponible');}
console.info('Listado de autoridad: 200; no se invocó generación manual ni envío externo.');
const fees=await fetch(`${base}/api/v1/cuotas`,{headers:{Cookie:cookie}});
if(fees.status!==200)throw new Error('Cuotas y saldos no disponibles');
const financeData=(await fees.json()).data;
if(!Array.isArray(financeData.cuotas)||financeData.moneda!=='MXN')throw new Error('Cuotas y moneda MXN no disponibles');
console.info('Cuotas y saldos: 200; no se registraron cobros ni pagos ficticios.');
for(const path of ['/api/v1/auth/me','/api/v1/usuarios','/api/v1/grupos','/api/v1/aulas/grupos','/api/v1/medicamentos/dosis','/api/v1/comedor/catalogos','/api/v1/comedor/presentes','/api/v1/recepcion/salidas','/api/v1/enfermeria/menores','/api/v1/enfermeria/recolecciones','/api/v1/enfermeria/cobertura','/api/v1/admin/menores','/api/v1/preinscripciones','/api/v1/personas','/api/v1/insumos/tipos','/api/v1/recetas/menores','/reportes/grupos','/api/v1/openapi.json']){
  const result=await fetch(`${base}${path}`,{headers:{Cookie:cookie}});
  if(result.status!==200)throw new Error(`${path}: HTTP ${result.status}`);
  if(path.endsWith('/openapi.json')&&(await result.json()).info.version!=='4.0.0')throw new Error('La API desplegada no incluye enfermería de S5');
  if(path==='/api/v1/admin/menores')sampleChild=(await result.json()).data[0]?.id_menor||null;
  if(path==='/api/v1/aulas/grupos')sampleGroup=(await result.json()).data[0]?.id_grupo||null;
  console.info(`${path}: 200`);
}
if(sampleGroup){const result=await fetch(`${base}/api/v1/aulas/grupos/${sampleGroup}/actividades`,{headers:{Cookie:cookie}});if(result.status!==200)throw new Error(`Actividades: HTTP ${result.status}`);console.info('Consulta de actividades S4: 200');}
if(sampleChild)for(const path of [`/api/v1/recepcion/menor/${sampleChild}?tipo=ID`,`/api/v1/recetas/menor/${sampleChild}`,`/api/v1/insumos/menor/${sampleChild}`]){
  const result=await fetch(`${base}${path}`,{headers:{Cookie:cookie}});if(result.status!==200)throw new Error(`Consulta S3: HTTP ${result.status}`);console.info('Consulta de ficha/recetas/insumos S3: 200');
}
const logout=await fetch(`${base}/api/v1/auth/logout`,{method:'POST',headers:{Cookie:cookie,'X-CSRF-Token':data.csrfToken}});
if(logout.status!==204)throw new Error('No se pudo revocar la sesión');
console.info('Login, proxy React → Express, lecturas, EJS y logout verificados sin mostrar credenciales.');
