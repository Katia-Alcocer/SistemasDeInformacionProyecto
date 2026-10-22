import {transaction,lockAdministration,audit} from '../../utils/transaction.js';
import {operationalTime} from '../../utils/clock.js';
import {HttpError} from '../../utils/http.js';
import * as repo from './retardos.repository.js';
export function retardosService(pool,config){
 async function clock(db){const [rows]=await db.query('SELECT * FROM configuracion_operativa WHERE id_config=1');return {policy:rows[0],time:operationalTime(config.clock?config.clock():new Date(),rows[0].zona_horaria)};}
 return {
  reviews:(value,actor)=>transaction(pool,async db=>{await lockAdministration(db);const {time}=await clock(db),year=value===undefined?time.date.slice(0,4):value;if(typeof year!=='string'||!/^\d{4}$/.test(year)||Number(year)<2000||Number(year)>Number(time.date.slice(0,4)))throw new HttpError(400,'INVALID_YEAR','Indica un año válido no futuro desde 2000');await audit(db,actor,'retardos',Number(year),'CONSULTAR_REVISIONES');return {anio:Number(year),limite_anual:3,criterio:'PERSONA_RECEPTORA',retardos:await repo.reviews(db,Number(year))};}),
  decide:(id,input,actor)=>transaction(pool,async db=>{
   await lockAdministration(db);const {time}=await clock(db),r=await repo.review(db,id);if(!r)throw new HttpError(404,'NOT_FOUND','Retardo no encontrado');
   if(r.estado!=='PENDIENTE'){const decision=await repo.decision(db,id);if(r.estado!==input.estado||decision?.motivo!==input.motivo)throw new HttpError(409,'DECISION_EXISTS','La decisión registrada no se puede sustituir');return {id_retardo:Number(id),estado:r.estado,aprobado_at:r.aprobado_at,repetido:true};}
   if(input.estado==='APROBADO'){
    if(!r.entregado_at||r.entregado_at>time.utc||r.ingreso_at>r.entregado_at||r.resumen_diario?.tardia!==true)throw new HttpError(422,'LATE_DELIVERY_REQUIRED','Solo una entrega tardía real puede consumir tolerancia');
    if(!r.id_persona||r.identidad_receptor?.id_persona!==r.id_persona)throw new HttpError(422,'RECEIVER_REQUIRED','El contador debe corresponder al receptor real de la entrega');
    if(r.anio!==Number(r.fecha.slice(0,4)))throw new HttpError(422,'INVALID_DELAY_YEAR','El año debe corresponder a la asistencia');
    if(!r.aviso_at||r.aviso_at<r.ingreso_at||r.aviso_at>=r.entregado_at||!r.justificacion?.trim())throw new HttpError(422,'PRIOR_NOTICE_REQUIRED','La aprobación requiere aviso previo válido y motivo comunicado');
    if(await repo.approved(db,r.id_persona,r.anio)>=3)throw new HttpError(409,'ANNUAL_LIMIT','La persona receptora ya tiene tres justificaciones aprobadas en ese año');
    await db.execute("UPDATE retardos SET estado='APROBADO',aprobado_por=?,aprobado_at=? WHERE id_retardo=?",[actor,time.utc,id]);
   }else await db.execute("UPDATE retardos SET estado='RECHAZADO' WHERE id_retardo=?",[id]);
   await audit(db,actor,'retardos',Number(id),'RESOLVER_JUSTIFICACION',{estado:input.estado,motivo:input.motivo,id_persona:r.id_persona,anio:r.anio,resuelta_at:time.utc,resuelta_por:actor});return {id_retardo:Number(id),estado:input.estado,aprobado_at:input.estado==='APROBADO'?time.utc:null,repetido:false};
  }),
  list:actor=>transaction(pool,async db=>{await lockAdministration(db);const {time,policy}=await clock(db);const [rows]=await db.execute(`SELECT a.id_asistencia,a.id_menor,m.nombres,m.apellido_paterno,e.id_entrega,r.id_retardo,r.aviso_at,r.justificacion,r.estado,r.id_persona FROM asistencias a JOIN menores m USING(id_menor) LEFT JOIN entregas e USING(id_asistencia) LEFT JOIN retardos r USING(id_asistencia) WHERE a.fecha=? ORDER BY a.id_asistencia`,[time.date]);await audit(db,actor,'retardos',Number(time.date.replaceAll('-','')),'CONSULTAR_AVISOS');return {fecha_operativa:time.date,hora_servidor:time.time,limite_aviso_exclusivo:policy.hora_fin_salida,asistencias:rows};}),
  notice:(id,input,actor)=>transaction(pool,async db=>{
   await lockAdministration(db);const {time,policy}=await clock(db);const [rows]=await db.execute('SELECT * FROM asistencias WHERE id_asistencia=?',[id]);const a=rows[0];if(!a)throw new HttpError(404,'NOT_FOUND','Asistencia no encontrada');
   const [previous]=await db.execute('SELECT * FROM retardos WHERE id_asistencia=?',[id]);const prior=previous[0];
   // PUT inmutable: repetir recupera la primera hora, incluso tras la entrega.
   if(prior?.aviso_at){if(prior.justificacion!==input.justificacion)throw new HttpError(409,'NOTICE_EXISTS','El aviso original se conserva; no se permite sustituirlo');return {id_retardo:prior.id_retardo,aviso_at:prior.aviso_at,repetido:true};}
   if(a.fecha!==time.date||a.ingreso_at>time.utc)throw new HttpError(422,'INVALID_ATTENDANCE','El aviso corresponde a una asistencia actual ya ingresada');
   const [delivery]=await db.execute('SELECT id_entrega FROM entregas WHERE id_asistencia=?',[id]);if(delivery.length)throw new HttpError(422,'ALREADY_DELIVERED','La asistencia ya tiene entrega');
   if(time.time>=policy.hora_fin_salida)throw new HttpError(422,'NOTICE_TOO_LATE','No se registra aviso previo después del límite de salida');
   if(prior)throw new HttpError(409,'DELAY_EXISTS','El retardo existente requiere revisión; no se sustituye');
   const [r]=await db.execute("INSERT INTO retardos(id_asistencia,aviso_at,justificacion,anio,estado) VALUES (?,?,?,?,'PENDIENTE')",[id,time.utc,input.justificacion,Number(time.date.slice(0,4))]);
   await audit(db,actor,'retardos',r.insertId,'REGISTRAR_AVISO',{id_asistencia:Number(id),aviso_at:time.utc,justificacion:input.justificacion});return {id_retardo:r.insertId,aviso_at:time.utc,repetido:false};
  }),
 };
}
