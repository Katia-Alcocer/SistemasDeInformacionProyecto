import {transaction,lockAdministration,audit} from '../../utils/transaction.js';
import {operationalTime} from '../../utils/clock.js';
import {validDate} from '../../utils/dates.js';
import {HttpError} from '../../utils/http.js';
import * as repo from './autoridad.repository.js';
export function autoridadService(pool,config){
 async function clock(db){const [rows]=await db.query('SELECT * FROM configuracion_operativa WHERE id_config=1');const policy=rows[0];return {policy,time:operationalTime(config.clock?config.clock():new Date(),policy.zona_horaria)};}
 return {
  synchronize:(actor=null)=>transaction(pool,async db=>{
   await lockAdministration(db);const {policy,time}=await clock(db);let generated=0;
   for(const r of await repo.candidates(db,time.date)){
    if(r.ingreso_at>time.utc||r.fecha===time.date&&time.time<policy.hora_fin_salida)continue;
    let reason=null;
    if(!r.id_entrega)reason='SIN_ENTREGA_AL_CORTE';
    else if(r.entregado_at<=time.utc&&r.resumen_diario?.tardia===true){
     if(r.estado_justificacion==='APROBADO')continue;
     if(!r.aviso_at)reason='ENTREGA_TARDIA_SIN_AVISO';
     else if(r.estado_justificacion==='RECHAZADO')reason='JUSTIFICACION_RECHAZADA';
     else if(r.id_persona&&r.aprobados_anuales>=3)reason='LIMITE_ANUAL_AGOTADO';
    }
    if(!reason)continue;
    const content={origen:'CONTROL_SALIDAS',version:1,motivo:reason,fecha_asistencia:r.fecha,detectado_at:time.utc,zona_horaria:policy.zona_horaria,limite_salida:policy.hora_fin_salida,menor:{id_menor:r.id_menor,codigo:r.codigo,nombres:r.nombres,apellido_paterno:r.apellido_paterno},ingreso_at:r.ingreso_at,entrega:r.id_entrega?{id_entrega:r.id_entrega,entregado_at:r.entregado_at,receptor:r.identidad_receptor}:null,aviso_at:r.aviso_at,justificacion:r.justificacion,estado_justificacion:r.estado_justificacion,aprobados_anuales_receptor:r.id_persona?r.aprobados_anuales:null,limite_anual:3,envio_oficial:false};
    const [insert]=await db.execute("INSERT INTO reportes_autoridad(id_asistencia,tipo,generado_at,estado,id_usuario,contenido) VALUES (?,?,?,'GENERADO',?,?)",[r.id_asistencia,r.id_entrega?'OTRO':'NO_RECOGIDO',time.utc,actor,JSON.stringify(content)]);
    await audit(db,actor,'reportes_autoridad',insert.insertId,'GENERAR',{id_asistencia:r.id_asistencia,motivo:reason,envio_oficial:false});generated++;
   }
   return {generados:generated,fecha_operativa:time.date,hora_servidor:time.time};
  }),
  list:(value,actor)=>transaction(pool,async db=>{await lockAdministration(db);const {time}=await clock(db),date=value===undefined?time.date:value;if(typeof date!=='string'||!validDate(date)||date>time.date)throw new HttpError(400,'INVALID_DATE','Indica fecha válida no futura YYYY-MM-DD');await audit(db,actor,'reportes_autoridad',Number(date.replaceAll('-','')),'CONSULTAR');return {fecha:date,reportes:await repo.list(db,date)};}),
  detail:(id,actor)=>transaction(pool,async db=>{await lockAdministration(db);const r=await repo.detail(db,id);if(!r)throw new HttpError(404,'NOT_FOUND','Reporte no encontrado');if(!r.contenido)throw new HttpError(409,'SNAPSHOT_UNAVAILABLE','El reporte anterior no tiene instantánea verificable');await audit(db,actor,'reportes_autoridad',Number(id),'CONSULTAR_DOCUMENTO');return r;}),
 };
}
