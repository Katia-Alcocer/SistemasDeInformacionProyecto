import * as repo from './aulas.repository.js';
import * as inventory from '../insumos/insumos.repository.js';
import {supplyAlert} from '../insumos/insumos.alerts.js';
import {HttpError} from '../../utils/http.js';
import {operationalTime} from '../../utils/clock.js';
import {transaction,lockAdministration,audit} from '../../utils/transaction.js';
import {createHash} from 'node:crypto';
import {validDate} from '../../utils/dates.js';
export async function operationDate(db,config){const [rows]=await db.query('SELECT zona_horaria FROM configuracion_operativa WHERE id_config=1');return operationalTime(config.clock?config.clock():new Date(),rows[0].zona_horaria).date;}
export async function requirePresentChild(db,child,user,date){
  const present=await repo.presentGroup(db,child,date),allowed=await repo.groups(db,user,date);
  if(!present.some(p=>allowed.some(g=>g.id_grupo===p.id_grupo)))throw new HttpError(403,'CLASSROOM_SCOPE','El menor debe estar presente hoy en un grupo autorizado');
}
export function aulasService(pool,config){return {
  groups:async user=>repo.groups(pool,user,await operationDate(pool,config)),
  activities:async(group,user,requested)=>transaction(pool,async db=>{
    await lockAdministration(db);const today=await operationDate(db,config),date=requested===undefined?today:requested;
    if(typeof date!=='string'||!validDate(date)||date>today)throw new HttpError(400,'INVALID_DATE','Consulta una fecha civil válida no futura');
    const current=await repo.groups(db,user,today),historical=await repo.groups(db,user,date),allowed=current.filter(g=>historical.some(h=>h.id_grupo===g.id_grupo));
    if(!allowed.some(g=>String(g.id_grupo)===String(group)))throw new HttpError(403,'CLASSROOM_SCOPE','Grupo fuera de tu asignación vigente');
    const result={fecha_operativa:today,fecha_consulta:date,menores:date===today?await repo.children(db,group,date):[],actividades:await repo.activities(db,group,date)};
    await audit(db,user.id_usuario,'grupos',group,'CONSULTAR_ACTIVIDADES',{fecha:date});return result;
  }),
  createActivity:async(group,input,key,user)=>transaction(pool,async db=>{
    await lockAdministration(db);const date=await operationDate(db,config),allowed=await repo.groups(db,user,date);
    if(!allowed.some(g=>String(g.id_grupo)===String(group)))throw new HttpError(403,'CLASSROOM_SCOPE','Grupo fuera de tu asignación vigente');
    if(!/^[A-Za-z0-9_-]{8,64}$/.test(key||''))throw new HttpError(400,'IDEMPOTENCY_REQUIRED','Envía Idempotency-Key válida de 8 a 64 caracteres');
    const participants=[...input.participantes].sort((a,b)=>a.id_asistencia-b.id_asistencia),hash=createHash('sha256').update(JSON.stringify([String(group),input.titulo,input.descripcion,participants])).digest('hex'),scoped=`${user.id_usuario}:${key}`,prior=await repo.previousActivity(db,scoped);
    if(prior){if(prior.solicitud_hash!==hash)throw new HttpError(409,'IDEMPOTENCY_CONFLICT','La clave ya se usó con otros datos');return {id_actividad:prior.id_actividad,fecha:prior.fecha,repetido:true};}
    const present=await repo.children(db,group,date);
    if(participants.some(p=>!present.some(c=>c.id_asistencia===p.id_asistencia)))throw new HttpError(422,'INVALID_PARTICIPATION','Cada participante debe estar presente hoy en este grupo, sin entrega registrada');
    const id=await repo.addActivity(db,group,date,{...input,participantes:participants},user.id_usuario,scoped,hash);
    await audit(db,user.id_usuario,'actividades_aula',id,'REGISTRAR_ACTIVIDAD',{id_grupo:Number(group),fecha:date,asistencias:participants.map(p=>p.id_asistencia)});return {id_actividad:id,fecha:date,repetido:false};
  }),
  monitor:async(group,user)=>transaction(pool,async db=>{
    await lockAdministration(db);const date=await operationDate(db,config),allowed=await repo.groups(db,user,date);
    if(!allowed.some(g=>String(g.id_grupo)===String(group)))throw new HttpError(403,'CLASSROOM_SCOPE','Grupo fuera de tu asignación vigente');
    const children=await repo.children(db,group,date);
    const results=[];for(const child of children)results.push({...child,insumos:(await inventory.stock(db,child.id_menor)).map(supplyAlert),avisos:await inventory.notices(db,child.id_menor)});
    await audit(db,user.id_usuario,'grupos',group,'CONSULTAR_INVENTARIO_AULA',{fecha:date});
    return {fecha_operativa:date,grupo:allowed.find(g=>String(g.id_grupo)===String(group)),menores:results};
  }),
};}
