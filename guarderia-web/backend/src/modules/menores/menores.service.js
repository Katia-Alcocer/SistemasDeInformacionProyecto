import * as repo from './menores.repository.js';
import {HttpError} from '../../utils/http.js';
import {transaction,lockAdministration,audit,civilDate} from '../../utils/transaction.js';
import {ageCategory} from '../../utils/dates.js';
export const presentChild=c=>({...c,curp:c.curp?`${c.curp.slice(0,4)}**********${c.curp.slice(-4)}`:null,registro_civil_validado:Boolean(c.registro_civil_validado),categoria_edad:ageCategory(c.fecha_nacimiento,civilDate())});
export async function requireChild(db,id,lock=false){const child=await repo.find(db,id,lock);if(!child)throw new HttpError(404,'NOT_FOUND','Expediente no encontrado');return child;}
export function menoresService(pool){
  return {
    list:async()=> (await repo.list(pool)).map(presentChild),
    detail:async id=>{const c=await requireChild(pool,id);return {...presentChild(c),documentos:await repo.documents(pool,id),historial_grupos:await repo.history(pool,id)};},
    auditExport:(id,actor)=>transaction(pool,async db=>{await lockAdministration(db);const c=await requireChild(db,id);const exportedAt=new Date().toISOString();await audit(db,actor,'menores',Number(id),'EXPORTAR_AUDITORIA',{codigo:c.codigo,detalle_completo:true});const events=await repo.auditHistory(db,id);return {version:1,tipo:'AUDITORIA_EXPEDIENTE',exportado_at:exportedAt,menor:{id_menor:Number(id),codigo:c.codigo,nombres:c.nombres,apellido_paterno:c.apellido_paterno,estatus:c.estatus},eventos:events};}),
    printableReport:(id,actor)=>transaction(pool,async db=>{await lockAdministration(db);const c=await requireChild(db,id);const exportedAt=new Date().toISOString(),today=civilDate();const documentos=await repo.documents(db,id);const historial_grupos=await repo.history(db,id);const autorizados=(await repo.authorizedPeople(db,id)).map(a=>({...a,vigente:a.activo&&a.fecha_inicio<=today&&(!a.fecha_fin||a.fecha_fin>today)}));const gafetes=await repo.badges(db,id);await audit(db,actor,'menores',Number(id),'EXPORTAR_EXPEDIENTE',{codigo:c.codigo,documentos:documentos.length,autorizados:autorizados.length});return {exportado_at:exportedAt,menor:presentChild(c),documentos,historial_grupos,autorizados,gafetes};}),
    create:async(input,actor)=>transaction(pool,async db=>{
      await lockAdministration(db);
      if(input.fecha_nacimiento>civilDate())throw new HttpError(422,'FUTURE_BIRTH','La fecha de nacimiento no puede ser futura');
      if(input.id_preinscripcion){const p=await repo.preinscription(db,input.id_preinscripcion);if(!p||p.estado!=='CONFIRMADA')throw new HttpError(422,'INVALID_PREINSCRIPTION','Preinscripción inexistente o cancelada');if(await repo.preinscriptionLinked(db,input.id_preinscripcion))throw new HttpError(409,'PREINSCRIPTION_ALREADY_LINKED','La solicitud ya está vinculada a un menor');}
      const id=await repo.insert(db,input);
      await audit(db,actor,'menores',id,'CREAR',{codigo:input.codigo,estatus:'PENDIENTE',id_preinscripcion:input.id_preinscripcion||null,preferencia_admision:Boolean(input.id_preinscripcion),identidad_madre_confirmada:input.id_preinscripcion?true:null});
      return presentChild(await repo.find(db,id));
    }),
    update:async(id,input,actor)=>transaction(pool,async db=>{
      await lockAdministration(db);const before=await requireChild(db,id,true);
      if(before.estatus==='ACTIVO')throw new HttpError(409,'ACTIVE_RECORD','Pasa el expediente a pendiente antes de cambiar identidad o nacimiento');
      const next={...before,...input};if(next.fecha_nacimiento>civilDate())throw new HttpError(422,'FUTURE_BIRTH','Nacimiento futuro');
      await repo.update(db,id,next);await repo.invalidateCivil(db,id);
      const after=await repo.find(db,id);await audit(db,actor,'menores',id,'ACTUALIZAR',{antes:presentChild(before),despues:presentChild(after),campos:Object.keys(input),registro_civil_invalidado:true});return presentChild(after);
    }),
    review:async(id,actor)=>transaction(pool,async db=>{
      await lockAdministration(db);const child=await requireChild(db,id,true);
      const docs=await repo.documents(db,id);
      if(!child.curp||!['ACTA_NACIMIENTO','CURP'].every(type=>docs.some(d=>d.tipo===type&&d.validado)))throw new HttpError(422,'DOCUMENTS_REQUIRED','Requiere CURP y documentos de acta/CURP validados');
      await repo.markCivil(db,id);await audit(db,actor,'menores',id,'VALIDAR_REGISTRO_CIVIL',{metodo:'REVISION_MANUAL',documentos:docs.filter(d=>d.validado).map(d=>d.id_documento)});
      return presentChild(await repo.find(db,id));
    }),
    activate:async(id,input,actor)=>transaction(pool,async db=>{
      await lockAdministration(db);const today=civilDate();const child=await requireChild(db,id,true);
      if(['BAJA','EXPULSADO'].includes(child.estatus))throw new HttpError(409,'INACTIVE_RECORD','Reabre explícitamente el expediente como pendiente antes de activarlo');
      const category=ageCategory(child.fecha_nacimiento,today);if(!category)throw new HttpError(422,'AGE_NOT_ADMISSIBLE','Edad requerida: 30 días cumplidos y antes del cuarto cumpleaños');
      if(!child.registro_civil_validado)throw new HttpError(422,'CIVIL_REVIEW_REQUIRED','Falta validación manual de Registro Civil');
      const docs=await repo.documents(db,id);if(!['ACTA_NACIMIENTO','CURP'].every(t=>docs.some(d=>d.tipo===t&&d.validado)))throw new HttpError(422,'DOCUMENTS_REQUIRED','Faltan documentos validados');
      const group=await repo.group(db,input.id_grupo,today);if(!group||group.categoria!==category)throw new HttpError(422,'GROUP_AGE_MISMATCH','Selecciona un grupo activo con responsable y categoría compatible');
      const current=await repo.currentGroup(db,id,today);if(current.length>1)throw new HttpError(409,'OVERLAPPING_GROUPS','Historial de grupos inconsistente');
      if(current[0]?.id_grupo===input.id_grupo&&child.estatus==='ACTIVO')return presentChild(child);
      if(await repo.occupancy(db,input.id_grupo,today)>=group.capacidad)throw new HttpError(409,'GROUP_FULL','El grupo no tiene cupo');
      await repo.assign(db,id,input.id_grupo,today);
      await audit(db,actor,'menores',id,'ACTIVAR_ASIGNAR_GRUPO',{antes:{estatus:child.estatus,id_grupo:current[0]?.id_grupo||null},despues:{estatus:'ACTIVO',id_grupo:input.id_grupo}});return presentChild(await repo.find(db,id));
    }),
    status:async(id,input,actor)=>transaction(pool,async db=>{await lockAdministration(db);const child=await requireChild(db,id,true);await repo.status(db,id,input.estatus,input.motivo,civilDate());await audit(db,actor,'menores',id,'CAMBIAR_ESTADO',{antes:child.estatus,despues:input.estatus,motivo:input.motivo});return presentChild(await repo.find(db,id));}),
  };
}
