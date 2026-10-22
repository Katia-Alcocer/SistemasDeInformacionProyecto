import {createHash} from 'node:crypto';
import * as repo from './salidas.repository.js';
import {transaction,lockAdministration,audit} from '../../utils/transaction.js';
import {operationalTime} from '../../utils/clock.js';
import {HttpError} from '../../utils/http.js';
export function salidasService(pool,config){
  async function clock(db){const [rows]=await db.query('SELECT * FROM configuracion_operativa WHERE id_config=1');return {policy:rows[0],time:operationalTime(config.clock?config.clock():new Date(),rows[0].zona_horaria)};}
  async function available(db,a,time){return {asistencia:a,entrega:await repo.delivery(db,a.id_asistencia),autorizados:await repo.links(db,a.id_menor,time.date),recolecciones:await repo.pickupAlerts(db,a,time),resumen:await repo.summary(db,a,time.date)};}
  return {
    list:async actor=>transaction(pool,async db=>{await lockAdministration(db);const {time,policy}=await clock(db);await audit(db,actor,'salidas',Number(time.date.replaceAll('-','')),'CONSULTAR_BITACORA');return {fecha_operativa:time.date,hora_servidor:time.time,ventana:{inicio:policy.hora_inicio_salida,fin_exclusivo:policy.hora_fin_salida},asistencias:await repo.current(db,time.date)};}),
    detail:(id,actor)=>transaction(pool,async db=>{await lockAdministration(db);const {time}=await clock(db),a=await repo.attendance(db,id);if(!a)throw new HttpError(404,'NOT_FOUND','Asistencia no encontrada');if(a.fecha!==time.date)throw new HttpError(422,'ATTENDANCE_DATE','Consulta una asistencia del día actual');await audit(db,actor,'asistencias',id,'CONSULTAR_SALIDA');return {fecha_operativa:time.date,hora_servidor:time.time,...await available(db,a,time)};}),
    exit:(input,key,actor)=>transaction(pool,async db=>{
      await lockAdministration(db);const {time,policy}=await clock(db),a=await repo.attendance(db,input.id_asistencia);if(!a)throw new HttpError(404,'NOT_FOUND','Asistencia no encontrada');
      const reject=async(code,message)=>{await audit(db,actor,'asistencias',a.id_asistencia,'RECHAZAR_SALIDA',{codigo:code,fecha_operativa:time.date,hora:time.time,id_vinculo_solicitado:input.id_vinculo});return {rechazada:true,codigo:code,mensaje:message,id_asistencia:a.id_asistencia};};
      if(!/^[A-Za-z0-9_-]{8,64}$/.test(key||''))throw new HttpError(400,'IDEMPOTENCY_REQUIRED','Envía Idempotency-Key válida de 8 a 64 caracteres');
      const badgeHash=input.codigo_gafete?createHash('sha256').update(input.codigo_gafete).digest('hex'):null;
      // Nunca persistir código de gafete en claro ni siquiera en la solicitud idempotente.
      const hash=createHash('sha256').update(JSON.stringify([input.id_asistencia,input.id_vinculo,badgeHash,input.identidad_verificada,input.metodo_verificacion,input.confirmacion,input.observaciones,...(input.id_alerta_recoleccion?[input.id_alerta_recoleccion]:[])])).digest('hex'),scoped=`${actor}:${key}`,prior=await repo.previous(db,scoped);
      if(prior){if(prior.solicitud_hash!==hash)throw new HttpError(409,'IDEMPOTENCY_CONFLICT','La clave ya se usó con otros datos');const {solicitud_hash:_hash,...result}=prior;return {...result,repetido:true};}
      if(a.fecha!==time.date)return reject('ATTENDANCE_DATE','La entrega corresponde a una asistencia del día actual');
      if(await repo.delivery(db,a.id_asistencia))return reject('ALREADY_DELIVERED','La asistencia ya tiene una entrega registrada');
      const alerts=await repo.pickupAlerts(db,a,time);
      if(input.id_alerta_recoleccion&&!alerts.some(r=>r.id_alerta===input.id_alerta_recoleccion))return reject('INVALID_PICKUP_ALERT','La alerta debe estar abierta y corresponder a la atención/asistencia del mismo menor');
      if(time.time<policy.hora_inicio_salida&&!input.id_alerta_recoleccion)return reject('TOO_EARLY','Antes de la ventana ordinaria selecciona una solicitud urgente vigente de enfermería');
      if(a.ingreso_at>time.utc)return reject('INVALID_TIME','La entrega no puede preceder al ingreso');
      const link=await repo.link(db,a.id_menor,input.id_vinculo);
      if(!link||!link.persona_activa||link.fecha_inicio>time.date||(link.fecha_fin!==null&&link.fecha_fin<=time.date))return reject('UNAUTHORIZED_PERSON','Selecciona una persona activa con vínculo autorizado vigente del mismo menor');
      if(link.restriccion_judicial||await repo.judicial(db,a.id_menor,link.id_persona,time.date))return reject('JUDICIAL_RESTRICTION','La persona tiene una restricción judicial vigente');
      if(!link.puede_recoger)return reject('UNAUTHORIZED_PERSON','La persona no está autorizada para recoger al menor');
      let badge=null;if(badgeHash){badge=await repo.badge(db,a.id_menor,badgeHash);if(!badge||badge.estado!=='ACTIVO')return reject('INVALID_BADGE','El gafete no está activo o no corresponde al menor');}
      const [open]=await db.execute('SELECT id_traslado FROM traslados_comedor WHERE id_asistencia=? AND salida_at IS NULL',[a.id_asistencia]);if(open.length)return reject('DINING_STILL_OPEN','Registra el regreso acompañado de comedor antes de la entrega');
      const summary={...await repo.summary(db,a,time.date),observaciones_entrega:input.observaciones,entregado_at:time.utc,tardia:time.time>=policy.hora_fin_salida,id_alerta_recoleccion:input.id_alerta_recoleccion||null};
      const id=await repo.insert(db,a,link,badge,input,actor,time,summary,scoped,hash);
      for(const alert of alerts){await db.execute("UPDATE alertas_recoleccion SET estado='CERRADO',resuelta_at=?,motivo_cierre='ENTREGA_REGISTRADA' WHERE id_alerta=?",[time.utc,alert.id_alerta]);await audit(db,actor,'alertas_recoleccion',alert.id_alerta,'CERRAR_POR_ENTREGA',{id_entrega:id});}
      const [delays]=await db.execute('SELECT id_retardo FROM retardos WHERE id_asistencia=?',[a.id_asistencia]);
      if(delays.length){await db.execute('UPDATE retardos SET id_persona=? WHERE id_retardo=? AND id_persona IS NULL',[link.id_persona,delays[0].id_retardo]);await audit(db,actor,'retardos',delays[0].id_retardo,'VINCULAR_ENTREGA',{id_entrega:id,id_persona:link.id_persona,tardia:summary.tardia});}
      else if(summary.tardia)await db.execute("INSERT INTO retardos(id_asistencia,id_persona,anio,estado) VALUES (?,?,?,'PENDIENTE')",[a.id_asistencia,link.id_persona,Number(time.date.slice(0,4))]);
      await audit(db,actor,'entregas',id,'ENTREGAR_MENOR',{id_asistencia:a.id_asistencia,id_menor:a.id_menor,id_vinculo:link.id_vinculo,id_persona:link.id_persona,id_gafete:badge?.id_gafete||null,tardia:summary.tardia,metodo:input.metodo_verificacion});return {id_entrega:id,id_asistencia:a.id_asistencia,entregado_at:time.utc,tardia:summary.tardia,repetido:false};
    }),
  };
}
