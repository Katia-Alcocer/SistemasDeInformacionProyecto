import {createHash} from 'node:crypto';
import * as repo from './enfermeria.repository.js';
import {requireChild} from '../menores/menores.service.js';
import {transaction,lockAdministration,audit} from '../../utils/transaction.js';
import {operationalTime} from '../../utils/clock.js';
import {validDate} from '../../utils/dates.js';
import {HttpError} from '../../utils/http.js';
export function enfermeriaService(pool,config){
 async function clock(db){const [rows]=await db.query('SELECT zona_horaria FROM configuracion_operativa WHERE id_config=1');return {...operationalTime(config.clock?config.clock():new Date(),rows[0].zona_horaria),zone:rows[0].zona_horaria};}
 function operation(input,key,actor){if(!/^[A-Za-z0-9_-]{8,64}$/.test(key||''))throw new HttpError(400,'IDEMPOTENCY_REQUIRED','Envía Idempotency-Key válida de 8 a 64 caracteres');return {key:`${actor}:${key}`,hash:createHash('sha256').update(JSON.stringify(input)).digest('hex')};}
 async function previous(db,table,op){const row=await repo.previous(db,table,op.key);if(row&&row.solicitud_hash!==op.hash)throw new HttpError(409,'IDEMPOTENCY_CONFLICT','La clave ya se usó con otros datos');return row;}
 return {
  children:()=>repo.children(pool),
  detail:(id,actor)=>transaction(pool,async db=>{await lockAdministration(db);const m=await requireChild(db,id),time=await clock(db);await audit(db,actor,'menores',id,'CONSULTAR_ENFERMERIA');return {menor:{id_menor:m.id_menor,nombres:m.nombres,apellido_paterno:m.apellido_paterno,estatus:m.estatus},fecha_operativa:time.date,asistencia:await repo.attendance(db,id,time.date),...await repo.history(db,id)};}),
  care:(input,key,actor)=>transaction(pool,async db=>{
    await lockAdministration(db);const op=operation(input,key,actor),prior=await previous(db,'atenciones_enfermeria',op);if(prior){const [alerts]=await db.execute('SELECT id_alerta FROM alertas_recoleccion WHERE id_atencion=? ORDER BY id_alerta LIMIT 1',[prior.id_atencion]);return {id_atencion:prior.id_atencion,id_alerta:alerts[0]?.id_alerta||null,repetido:true};}await requireChild(db,input.id_menor,true);const time=await clock(db),attendance=await repo.attendance(db,input.id_menor,time.date,input.id_asistencia);
    if(input.id_asistencia&&!attendance)throw new HttpError(422,'INVALID_ATTENDANCE','Selecciona la asistencia actual sin entrega del mismo menor');
    if(attendance?.ingreso_at>time.utc)throw new HttpError(422,'INVALID_TIME','La atención no puede preceder al ingreso');
    if(input.requiere_recoleccion&&!attendance)throw new HttpError(422,'PRESENCE_REQUIRED','La recolección urgente requiere asistencia presente de hoy');
    const [r]=await db.execute('INSERT INTO atenciones_enfermeria(id_menor,id_asistencia,id_usuario,atendido_at,motivo,acciones,requiere_recoleccion,clave_idempotencia,solicitud_hash) VALUES (?,?,?,?,?,?,?,?,?)',[input.id_menor,attendance?.id_asistencia||null,actor,time.utc,input.motivo,input.acciones,input.requiere_recoleccion,op.key,op.hash]);let alert=null;
    if(input.requiere_recoleccion){const [a]=await db.execute("INSERT INTO alertas_recoleccion(id_atencion,creada_at,motivo,estado) VALUES (?,?,?,'PENDIENTE')",[r.insertId,time.utc,'Recolección urgente solicitada por enfermería']);alert=a.insertId;await audit(db,actor,'alertas_recoleccion',alert,'SOLICITAR_RECOLECCION',{id_atencion:r.insertId,id_asistencia:attendance.id_asistencia});}
    await audit(db,actor,'atenciones_enfermeria',r.insertId,'REGISTRAR',{id_menor:input.id_menor,id_asistencia:attendance?.id_asistencia||null,requiere_recoleccion:input.requiere_recoleccion});return {id_atencion:r.insertId,id_alerta:alert,repetido:false};
  }),
  measure:(input,key,actor)=>transaction(pool,async db=>{
    await lockAdministration(db);const op=operation(input,key,actor),prior=await previous(db,'mediciones',op);if(prior)return {id_medicion:prior.id_medicion,repetido:true};const child=await requireChild(db,input.id_menor,true),time=await clock(db),month=time.date.slice(0,7)+'-01';
    if(input.tipo==='MENSUAL'){
      if(child.estatus!=='ACTIVO')throw new HttpError(422,'ACTIVE_CHILD_REQUIRED','La medición mensual corresponde a población activa');
      const [old]=await db.execute("SELECT id_medicion FROM mediciones WHERE id_menor=? AND tipo='MENSUAL' AND periodo_mensual=?",[input.id_menor,month]);if(old.length)throw new HttpError(409,'MONTH_ALREADY_MEASURED','Ya existe una medición mensual; conserva el historial');
    }else{
      const [a]=await db.execute('SELECT * FROM atenciones_enfermeria WHERE id_atencion=? AND id_menor=?',[input.id_atencion,input.id_menor]);if(!a.length||a[0].atendido_at>time.utc||operationalTime(new Date(a[0].atendido_at.replace(' ','T')+'Z'),time.zone).date!==time.date)throw new HttpError(422,'INVALID_CARE','Selecciona una atención de hoy del mismo menor');
    }
    const [r]=await db.execute('INSERT INTO mediciones(id_menor,id_atencion,id_usuario,fecha,peso_kg,talla_cm,tipo,periodo_mensual,clave_idempotencia,solicitud_hash) VALUES (?,?,?,?,?,?,?,?,?,?)',[input.id_menor,input.id_atencion,actor,time.date,input.peso_kg,input.talla_cm,input.tipo,input.tipo==='MENSUAL'?month:null,op.key,op.hash]);await audit(db,actor,'mediciones',r.insertId,'REGISTRAR',{id_menor:input.id_menor,tipo:input.tipo,periodo_mensual:input.tipo==='MENSUAL'?month:null,peso_kg:input.peso_kg,talla_cm:input.talla_cm});return {id_medicion:r.insertId,repetido:false};
  }),
  coverage:(value,actor)=>transaction(pool,async db=>{await lockAdministration(db);const time=await clock(db),current=time.date.slice(0,7),month=value===undefined?current:value;if(typeof month!=='string'||!/^\d{4}-\d{2}$/.test(month)||!validDate(month+'-01')||month>current)throw new HttpError(400,'INVALID_MONTH','Indica mes válido YYYY-MM no futuro');const rows=await repo.coverage(db,month+'-01'),pending=rows.filter(r=>!r.id_medicion).length;await audit(db,actor,'mediciones',Number(month.replace('-','')),'CONSULTAR_COBERTURA');return {mes:month,poblacion:'ACTIVOS_ACTUALES',total:rows.length,medidos:rows.length-pending,pendientes:pending,completa:pending===0,menores:rows};}),
  alerts:async actor=>transaction(pool,async db=>{await lockAdministration(db);const time=await clock(db);await audit(db,actor,'alertas_recoleccion',Number(time.date.replaceAll('-','')),'CONSULTAR_ABIERTAS');return {fecha_operativa:time.date,alertas:await repo.alerts(db)};}),
  contact:(id,input,actor)=>transaction(pool,async db=>{await lockAdministration(db);const a=await repo.alert(db,id);if(!a)throw new HttpError(404,'NOT_FOUND','Alerta no encontrada');if(a.estado==='CERRADO')throw new HttpError(409,'ALERT_CLOSED','La alerta está cerrada');if(a.estado==='CONTACTADO')return {id_alerta:Number(id),repetido:true};const time=await clock(db);await db.execute("UPDATE alertas_recoleccion SET estado='CONTACTADO',contactado_at=?,contactado_por=?,detalle_contacto=? WHERE id_alerta=?",[time.utc,actor,input.detalle,id]);await audit(db,actor,'alertas_recoleccion',id,'CONFIRMAR_CONTACTO',{detalle:input.detalle});return {id_alerta:Number(id),repetido:false};}),
  close:(id,input,actor)=>transaction(pool,async db=>{await lockAdministration(db);const a=await repo.alert(db,id);if(!a)throw new HttpError(404,'NOT_FOUND','Alerta no encontrada');if(a.estado==='CERRADO')return {id_alerta:Number(id),repetido:true};const time=await clock(db);await db.execute("UPDATE alertas_recoleccion SET estado='CERRADO',resuelta_at=?,motivo_cierre=? WHERE id_alerta=?",[time.utc,input.motivo,id]);await audit(db,actor,'alertas_recoleccion',id,'CANCELAR_SOLICITUD',{motivo:input.motivo});return {id_alerta:Number(id),repetido:false};}),
 };
}
