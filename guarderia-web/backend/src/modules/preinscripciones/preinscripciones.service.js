import * as repo from './preinscripciones.repository.js';
import {HttpError} from '../../utils/http.js';
import {transaction,lockAdministration,audit,civilDate} from '../../utils/transaction.js';
import {addMonths} from '../../utils/dates.js';
export function preinscripcionesService(pool){
  async function save(id,input,actor){return transaction(pool,async db=>{
    await lockAdministration(db);const today=civilDate();const previous=id?await repo.find(db,id):null;
    if(id&&!previous)throw new HttpError(404,'NOT_FOUND','Preinscripción no encontrada');
    const next={...previous,...input};const policy=await repo.policy(db);
    const months=policy.preinscripcion_meses;if(!Number.isInteger(months)||months<1||months>12)throw new HttpError(503,'POLICY_INVALID','Revisa la política de preinscripción');
    if(!previous||next.fecha_probable_parto!==previous.fecha_probable_parto){if(next.fecha_probable_parto<today||next.fecha_probable_parto>addMonths(today,months))throw new HttpError(422,'PREINSCRIPTION_WINDOW',`Fecha de parto requerida entre hoy y los siguientes ${months} meses calendario`);}
    if(id&&next.estado!==previous.estado&&await repo.linked(db,id))throw new HttpError(409,'LINKED_PREINSCRIPTION','La solicitud vinculada conserva su estado de preferencia; administra el estado del menor');
    if(id)await repo.update(db,id,next);else id=await repo.insert(db,next,today);
    await audit(db,actor,'preinscripciones',id,previous?'ACTUALIZAR':'CREAR',{antes:previous,despues:await repo.find(db,id),estado:next.estado||'PENDIENTE',campos:Object.keys(input)});
    return repo.find(db,id);
  });}
  return {list:()=>repo.list(pool),create:(input,actor)=>save(null,input,actor),update:(id,input,actor)=>save(id,input,actor)};
}
