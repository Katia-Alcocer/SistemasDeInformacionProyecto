const string=(maxLength=100)=>({type:'string',maxLength});
const integer={type:'integer',minimum:1};
const nullableId={type:['integer','null'],minimum:1};
const date={type:'string',format:'date'};
const schema=(properties,required=[])=>({type:'object',additionalProperties:false,properties,required});
const child={codigo:{...string(40),pattern:'^[A-Za-z0-9_-]+$'},nombres:string(),apellido_paterno:string(),apellido_materno:{type:['string','null'],maxLength:100},fecha_nacimiento:date,curp:{type:['string','null'],maxLength:18},id_preinscripcion:nullableId,confirmacion_madre:{type:'boolean',description:'true obligatorio al vincular una solicitud prenatal'}};
const pre={nombre_contacto:string(160),telefono_contacto:string(30),email_contacto:{type:['string','null'],format:'email'},fecha_probable_parto:date,posible_nombre_bebe:{type:['string','null'],maxLength:160,description:'Referencia opcional, no identifica ni crea al menor'},observaciones:{type:['string','null'],maxLength:1000}};
const person={nombre:string(180),telefono:{type:['string','null'],maxLength:30},email:{type:['string','null'],format:'email'},tipo_identificacion:{type:['string','null'],enum:['INE','PASAPORTE','OTRA',null]}};
const link={id_persona:integer,tipo:{type:'string',enum:['PRINCIPAL','AUXILIAR']},parentesco:string(70),puede_recoger:{type:'boolean'},restriccion_judicial:{type:'boolean'},id_documento_restriccion:nullableId,fecha_fin:{type:['string','null'],format:'date',description:'Fin exclusivo opcional, posterior a hoy; null no programa fin'}};
export function admissionOpenapi(base){
  const responses={200:{description:'JSON data/message/error; CURP enmascarada, sin rutas privadas ni hashes'},400:{description:'Payload o identificador inválido'},401:{description:'Sesión requerida'},403:{description:'Rol/origen/CSRF denegado'},404:{description:'Recurso no encontrado para este expediente'},409:{description:'Duplicado, cupo o conflicto de estado'},413:{description:'Archivo mayor de 2 MB'},415:{description:'Tipo de contenido no admitido'},422:{description:'Regla de admisión o integridad inválida'},500:{description:'Error interno sin detalles sensibles'},503:{description:'Almacenamiento o política sin configurar'}};
  const csrf={in:'header',name:'X-CSRF-Token',required:true,schema:{type:'string'}};
  const id=name=>({in:'path',name,required:true,schema:integer});
  const body=name=>({required:true,content:{'application/json':{schema:{$ref:`#/components/schemas/${name}`}}}});
  const operation=(summary,options={})=>({summary,security:[{session:[]}],responses,...options});
  const write=(summary,name,parameters=[],created=false)=>operation(summary,{parameters:[...parameters,csrf],...(name?{requestBody:body(name)}:{}),...(created?{responses:{...responses,201:{description:'Creado con persistencia'}}}:{})});
  const binary={required:true,content:Object.fromEntries(['application/pdf','image/png','image/jpeg'].map(m=>[m,{schema:{type:'string',format:'binary',description:'Cuerpo binario, no multipart. Máximo 2 MB.'}}]))};
  const download=summary=>operation(summary,{parameters:[id('id'),id('documentId')],responses:{...responses,200:{description:'Adjunto privado con Content-Disposition y MIME comprobado',content:Object.fromEntries(['application/pdf','image/png','image/jpeg'].map(m=>[m,{schema:{type:'string',format:'binary'}}]))}}});
  return {...base,info:{...base.info,title:'Guardería — entregas 1 y 2',version:'2.1.0'},components:{...base.components,schemas:{...base.components.schemas,
    Menor:schema(child,['codigo','nombres','apellido_paterno','fecha_nacimiento']),MenorPatch:{...schema(Object.fromEntries(Object.entries(child).filter(([k])=>k!=='id_preinscripcion'))),minProperties:1},ActivarMenor:schema({id_grupo:integer},['id_grupo']),RevisionCivil:schema({confirmacion:{const:true}},['confirmacion']),EstadoMenor:schema({estatus:{enum:['PENDIENTE','BAJA','EXPULSADO']},motivo:{type:'string',minLength:5,maxLength:500}},['estatus','motivo']),
    Preinscripcion:schema(pre,['nombre_contacto','telefono_contacto','fecha_probable_parto']),PreinscripcionPatch:{...schema({...pre,estado:{enum:['PENDIENTE','EN_ESPERA','CONFIRMADA','CANCELADA']}}),minProperties:1},Persona:schema(person,['nombre']),PersonaPatch:{...schema({...person,activo:{type:'boolean'}}),minProperties:1},MadrePreinscripcion:schema({id_persona:nullableId,confirmacion_identidad:{const:true},puede_recoger:{type:'boolean'}},['confirmacion_identidad']),Vinculo:schema(link,['id_persona','tipo','parentesco']),VinculoPatch:{...schema({...Object.fromEntries(Object.entries(link).filter(([k])=>k!=='id_persona')),vigente:{const:false}}),minProperties:1},DocumentoRevision:schema({validado:{type:'boolean'}},['validado']),GafeteEstado:schema({estado:{enum:['REVOCADO','EXTRAVIADO']}},['estado']),
  }},paths:{...base.paths,
    '/admin/menores':{get:operation('ADMIN/RECEPCION: listar hasta 500 expedientes; CURP enmascarada'),post:write('ADMIN: crear expediente PENDIENTE; sin activación automática','Menor',[],true)},
    '/admin/menores/{id}':{get:operation('ADMIN/RECEPCION: ficha, documentos (metadatos) e historial',{parameters:[id('id')]}),patch:write('ADMIN: editar identidad de expediente no activo; invalida revisión civil','MenorPatch',[id('id')])},
    '/admin/menores/{id}/registro-civil':{post:write('ADMIN: confirmar revisión manual de acta/CURP; sin integración oficial','RevisionCivil',[id('id')])},
    '/admin/menores/{id}/activar':{post:write('ADMIN: activar/reubicar validando edad, documentos, responsable y cupo','ActivarMenor',[id('id')])},
    '/admin/menores/{id}/estado':{post:write('ADMIN: pendiente, baja o expulsión auditada; conserva documentos e historial','EstadoMenor',[id('id')])},
    '/preinscripciones':{get:operation('ADMIN: listar preinscripciones'),post:write('ADMIN: solicitar dentro de ventana configurable de meses calendario','Preinscripcion',[],true)},
    '/preinscripciones/{id}':{patch:write('ADMIN: editar estado/contacto; confirmación no crea inscripción','PreinscripcionPatch',[id('id')])},
    '/personas':{get:operation('ADMIN/RECEPCION: personas reutilizables sin identificaciones completas'),post:write('ADMIN: registrar persona','Persona',[],true)},
    '/personas/{id}':{patch:write('ADMIN: editar o desactivar persona','PersonaPatch',[id('id')])},
    '/personas/{id}/identificacion':{get:{...download('ADMIN: descargar identificación privada'),parameters:[id('id')]},post:{...write('ADMIN: subir identificación privada una sola vez',null,[id('id')],true),requestBody:binary}},
    '/menores/{id}/autorizados':{get:operation('ADMIN/RECEPCION: vínculos y gafetes sin códigos secretos',{parameters:[id('id')]}),post:write('ADMIN: vincular persona; límites transaccionales por menor/tipo','Vinculo',[id('id')],true)},
    '/menores/{id}/autorizados/madre':{post:write('ADMIN: reutilizar datos de madre preinscrita y crear vínculo en una transacción; identidad confirmada','MadrePreinscripcion',[id('id')],true)},
    '/menores/{id}/autorizados/{linkId}':{patch:write('ADMIN: editar restricción o finalizar vínculo; no mover de menor','VinculoPatch',[id('id'),id('linkId')])},
    '/menores/{id}/gafetes':{post:write('ADMIN: emitir hasta tres gafetes; codigo se devuelve solo una vez',null,[id('id')],true)},
    '/menores/{id}/gafetes/{badgeId}':{patch:write('ADMIN: revocar/marcar extraviado un gafete del mismo menor','GafeteEstado',[id('id'),id('badgeId')])},
    '/admin/menores/{id}/documentos':{post:{...write('ADMIN: subir documento privado cifrado',null,[id('id'),{in:'header',name:'X-Document-Type',required:true,schema:{enum:['ACTA_NACIMIENTO','CURP','OTRO']}}],true),requestBody:binary}},
    '/admin/menores/{id}/documentos/{documentId}':{get:download('ADMIN: descarga privada con integridad y auditoría'),patch:write('ADMIN: revisar documento; sin activar automáticamente al menor','DocumentoRevision',[id('id'),id('documentId')])},
  }};
}
