import {createHash} from 'node:crypto';
import * as repo from './medicamentos.repository.js';
import * as classrooms from '../aulas/aulas.repository.js';
import {privateStorage} from '../documentos/storage.js';
import {operationalTime} from '../../utils/clock.js';
import {transaction,lockAdministration,audit} from '../../utils/transaction.js';
import {HttpError} from '../../utils/http.js';
import {ensureScheduledDoses} from './medicamentos.planning.js';
async function clock(db,config){const [rows]=await db.query('SELECT zona_horaria FROM configuracion_operativa WHERE id_config=1');return operationalTime(config.clock?config.clock():new Date(),rows[0].zona_horaria);}
async function scope(db,row,user,date){
  if(['ADMIN','ENFERMERIA'].includes(user.rol))return true;
  if(user.rol!=='EDUCADORA')return false;
  const groups=await classrooms.groups(db,user,date);
  const [history]=await db.execute('SELECT id_grupo FROM historial_grupos WHERE id_menor=? AND fecha_inicio<=? AND (fecha_fin IS NULL OR fecha_fin>?)',[row.id_menor,date,date]);
  return history.some(h=>groups.some(g=>g.id_grupo===h.id_grupo));
}
const due=(row,time)=>row.fecha_programada<time.date||(row.fecha_programada===time.date&&row.hora<=time.time);
export function medicamentosService(pool,config){const storage=privateStorage(config);
  const generate=(db,time)=>ensureScheduledDoses(db,time.date);
  return {
    synchronize:()=>transaction(pool,async db=>{await lockAdministration(db);const time=await clock(db,config);return {fecha:time.date,creadas:await generate(db,time)};}),
    list:user=>transaction(pool,async db=>{
      await lockAdministration(db);const time=await clock(db,config);await generate(db,time);const rows=await repo.list(db,time.date,user),result=[];
      for(const row of rows){if(!await scope(db,row,user,time.date))continue;
        const present=(await classrooms.presentGroup(db,row.id_menor,time.date)).length>0;
        const {ruta_segura:_path,hash_sha256:_hash,verificada_por:_verifier,verificada_at:_verified,...publicRow}=row;
        const current=!row.suspendido&&row.fecha_programada===time.date&&row.fecha_inicio<=time.date&&row.fecha_fin>=time.date&&row.vigencia_inicio<=time.date&&row.vigencia_fin>=time.date&&row.documento_validado&&row.verificada_por&&row.verificada_at&&row.permite_convivencia&&row.estatus==='ACTIVO';
        result.push({...publicRow,presente:present,vencida:due(row,time),alerta:row.estado==='PENDIENTE'&&due(row,time),puede_registrar:user.rol!=='EDUCADORA'||row.via!=='OTRA',puede_aplicar:Boolean(current&&present&&due(row,time)&&(!row.dosificador_requerido||row.dosificador_entregado)&&(user.rol!=='EDUCADORA'||row.via!=='OTRA'))});
      }
      await audit(db,user.id_usuario,'programacion_dosis',Number(time.date.replaceAll('-','')),'CONSULTAR_DOSIS',{fecha:time.date});return {fecha_operativa:time.date,hora_servidor:time.time,dosis:result};
    }),
    resolve:(id,input,key,user)=>transaction(pool,async db=>{
      await lockAdministration(db);const time=await clock(db,config),row=await repo.find(db,id);if(!row)throw new HttpError(404,'NOT_FOUND','Dosis no encontrada');
      if(!await scope(db,row,user,time.date))throw new HttpError(403,'MEDICATION_SCOPE','Dosis fuera de tu grupo autorizado');
      if(user.rol==='EDUCADORA'&&row.via==='OTRA')throw new HttpError(403,'ROUTE_FORBIDDEN','Esta vía requiere ADMIN o ENFERMERIA');
      if(!/^[A-Za-z0-9_-]{8,64}$/.test(key||''))throw new HttpError(400,'IDEMPOTENCY_REQUIRED','Envía Idempotency-Key válida de 8 a 64 caracteres');
      const scoped=`${user.id_usuario}:${key}`,hash=createHash('sha256').update(JSON.stringify([String(id),input])).digest('hex'),prior=await repo.previous(db,scoped);
      if(prior){if(prior.solicitud_hash!==hash)throw new HttpError(409,'IDEMPOTENCY_CONFLICT','La clave ya se usó con otros datos');const {solicitud_hash:_hash,...result}=prior;return {...result,repetido:true};}
      if(row.estado!=='PENDIENTE')throw new HttpError(409,'DOSE_ALREADY_RESOLVED','La dosis ya fue registrada; actualiza la lista');
      if(!due(row,time))throw new HttpError(422,'DOSE_NOT_DUE','El horario programado aún no llega');
      if(input.estado==='APLICADA'){
        if(row.suspendido||row.fecha_programada!==time.date||row.fecha_inicio>time.date||row.fecha_fin<time.date||row.vigencia_inicio>time.date||row.vigencia_fin<time.date||!row.verificada_por||!row.verificada_at||!row.documento_validado||!row.permite_convivencia)throw new HttpError(422,'PRESCRIPTION_INVALID','La receta y el tratamiento deben estar vigentes, no suspendidos y revisados hoy');
        if(row.estatus!=='ACTIVO'||!(await classrooms.presentGroup(db,row.id_menor,time.date)).length)throw new HttpError(422,'CHILD_NOT_PRESENT','El menor debe estar activo y presente hoy, sin entrega');
        if(row.dosificador_requerido&&!row.dosificador_entregado)throw new HttpError(422,'DISPENSER_REQUIRED','Falta el dosificador graduado requerido');
        if(Math.round(input.dosis_aplicada*1000)!==Math.round(Number(row.dosis)*1000))throw new HttpError(422,'DOSE_MISMATCH','La dosis debe coincidir exactamente con la prescripción');
        await storage.read(row.ruta_segura,row.hash_sha256);
      }
      await repo.resolve(db,id,input,user.id_usuario,time,scoped,hash);await audit(db,user.id_usuario,'administraciones_medicamento',id,input.estado,{id_menor:row.id_menor,id_tratamiento:row.id_tratamiento,fecha_programada:row.fecha_programada,hora:row.hora,dosis_aplicada:input.dosis_aplicada,resuelta_at:time.utc});return {id_administracion:Number(id),estado:input.estado,resuelta_at:time.utc,repetido:false};
    }),
    suspend:(id,input,user)=>transaction(pool,async db=>{
      await lockAdministration(db);if(!['ADMIN','ENFERMERIA'].includes(user.rol))throw new HttpError(403,'FORBIDDEN','La suspensión requiere ADMIN o ENFERMERIA');
      const [rows]=await db.execute('SELECT id_tratamiento,suspendido FROM tratamientos WHERE id_tratamiento=? FOR UPDATE',[id]);if(!rows.length)throw new HttpError(404,'NOT_FOUND','Tratamiento no encontrado');
      if(rows[0].suspendido)return {id_tratamiento:Number(id),suspendido:true,repetido:true};
      const time=await clock(db,config);await db.execute('UPDATE tratamientos SET suspendido=1 WHERE id_tratamiento=?',[id]);await audit(db,user.id_usuario,'tratamientos',id,'SUSPENDER',{motivo:input.motivo,suspendido_at:time.utc});return {id_tratamiento:Number(id),suspendido:true,repetido:false};
    }),
  };
}
