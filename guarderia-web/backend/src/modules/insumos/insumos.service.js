import {createHash} from 'node:crypto';
import * as repo from './insumos.repository.js';
import {requireChild} from '../menores/menores.service.js';
import {HttpError} from '../../utils/http.js';
import {transaction,lockAdministration,audit} from '../../utils/transaction.js';
import {supplyAlert} from './insumos.alerts.js';
import {operationDate,requirePresentChild} from '../aulas/aulas.service.js';
export function insumosService(pool,config={}){return {
  types:()=>repo.types(pool),
  list:async id=>{await requireChild(pool,id);return {revisados:await repo.reviewed(pool,id),insumos:(await repo.stock(pool,id)).map(supplyAlert),movimientos:await repo.history(pool,id),avisos:await repo.notices(pool,id)};},
  movement:async(input,key,user,classroom=false)=>transaction(pool,async db=>{
    await lockAdministration(db);
    if(!/^[A-Za-z0-9_-]{8,64}$/.test(key||''))throw new HttpError(400,'IDEMPOTENCY_REQUIRED','Envía Idempotency-Key válida de 8 a 64 caracteres');
    if(classroom){if(!['ADMIN','EDUCADORA'].includes(user.rol)||input.tipo!=='CONSUMO')throw new HttpError(403,'FORBIDDEN','Solo consumo autorizado en aula');}
    else if(!['ADMIN','RECEPCION'].includes(user.rol)||(input.tipo!=='ENTRADA'&&user.rol!=='ADMIN'))throw new HttpError(403,'FORBIDDEN','Consumos y ajustes fuera del aula requieren ADMIN');
    const item=await repo.findStock(db,input.id_insumo_menor);if(!item)throw new HttpError(404,'NOT_FOUND','Insumo individual no encontrado');
    if(classroom)await requirePresentChild(db,item.id_menor,user,await operationDate(db,config));
    const scoped=`${user.id_usuario}:${key}`,hash=createHash('sha256').update(JSON.stringify([input.id_insumo_menor,input.cantidad,input.tipo,input.motivo])).digest('hex'),prior=await repo.previous(db,scoped);
    if(prior){if(prior.solicitud_hash!==hash)throw new HttpError(409,'IDEMPOTENCY_CONFLICT','La clave ya se usó con otros datos');const {solicitud_hash:_ignored,...result}=prior;return {...result,repetido:true};}
    const delta=Math.round(input.cantidad*1000)*(input.tipo==='CONSUMO'?-1:1),scaled=Math.round(Number(item.cantidad_actual)*1000)+delta;
    if(scaled<0)throw new HttpError(422,'INSUFFICIENT_STOCK','El movimiento dejaría un saldo negativo');
    if(scaled>999999999999)throw new HttpError(422,'SUPPLY_OVERFLOW','El saldo excede el límite permitido');
    const result=await repo.add(db,item,(delta/1000).toFixed(3),(scaled/1000).toFixed(3),user.id_usuario,input.motivo,scoped,hash,input.tipo);
    await audit(db,user.id_usuario,'movimientos_insumo',result.id_movimiento,input.tipo,{id_menor:item.id_menor,cantidad_delta:(delta/1000).toFixed(3),...result});return {...result,repetido:false};
  }),
  notice:async(input,user,classroom=false)=>transaction(pool,async db=>{
    await lockAdministration(db);
    if(classroom?!['ADMIN','EDUCADORA'].includes(user.rol):!['ADMIN','RECEPCION'].includes(user.rol))throw new HttpError(403,'FORBIDDEN','No puedes confirmar este contacto');
    const item=await repo.findStock(db,input.id_insumo_menor);if(!item)throw new HttpError(404,'NOT_FOUND','Insumo individual no encontrado');
    const date=await operationDate(db,config);if(classroom)await requirePresentChild(db,item.id_menor,user,date);
    const alert=supplyAlert(item);if(alert.nivel_aviso===null||alert.nivel_aviso!==input.dias_estimados)throw new HttpError(409,'STALE_ALERT','El saldo cambió; actualiza el aviso antes de confirmar el contacto');
    const [prior]=await db.execute('SELECT id_aviso FROM avisos_insumo WHERE id_insumo_menor=? AND fecha=? AND dias_estimados=?',[item.id_insumo_menor,date,input.dias_estimados]);
    if(prior.length)return {id_aviso:prior[0].id_aviso,repetido:true};
    const [result]=await db.execute('INSERT INTO avisos_insumo(id_insumo_menor,fecha,dias_estimados,notificado_por,observaciones) VALUES (?,?,?,?,?)',[item.id_insumo_menor,date,input.dias_estimados,user.id_usuario,input.observaciones]);
    await audit(db,user.id_usuario,'avisos_insumo',result.insertId,'CONFIRMAR_CONTACTO_INSUMOS',{id_menor:item.id_menor,fecha:date,dias_estimados:input.dias_estimados});return {id_aviso:result.insertId,repetido:false};
  }),
  requirements:async(id,input,actor)=>transaction(pool,async db=>{await lockAdministration(db);await requireChild(db,id,true);const types=await repo.types(db);if(input.requerimientos.some(r=>!types.some(t=>t.id_tipo_insumo===r.id_tipo_insumo)))throw new HttpError(422,'INVALID_SUPPLY','Tipo de insumo inexistente o inactivo');const before=await repo.stock(db,id,true);await repo.setRequirements(db,id,input.requerimientos);await audit(db,actor,'insumos_menor',id,'REVISAR_REQUERIMIENTOS',{antes:before,despues:input.requerimientos,sin_insumos_confirmado:input.confirmacion_sin_insumos});return {revisados:true,insumos:await repo.stock(db,id)};}),};}
