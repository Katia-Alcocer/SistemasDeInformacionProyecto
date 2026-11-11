import {randomBytes,createHash} from 'node:crypto';
import * as repo from './tutores.repository.js';
import {HttpError} from '../../utils/http.js';
import {transaction,lockAdministration,audit,civilDate} from '../../utils/transaction.js';
import {requireChild} from '../menores/menores.service.js';
const active=(link,today)=>link.fecha_inicio<=today&&(!link.fecha_fin||link.fecha_fin>today);
export function tutoresService(pool){
  async function saveLink(child,id,input,actor){return transaction(pool,async db=>{
    await lockAdministration(db);await requireChild(db,child,true);const today=civilDate();const before=id?await repo.findLink(db,child,id):null;
    if(id&&!before)throw new HttpError(404,'NOT_FOUND','Vínculo no encontrado para este menor');
    if(before&&!active(before,today))throw new HttpError(409,'LINK_CLOSED','El vínculo terminó; crea uno nuevo para conservar historia');
    const next={...before,id_documento_restriccion:before?.respaldo_restriccion?Number(before.respaldo_restriccion.split(':')[1]):null,...input,fecha_fin:input.vigente===false?today:input.fecha_fin!==undefined?input.fecha_fin:before?.fecha_fin||null};
    if(input.vigente!==false&&next.fecha_fin&&next.fecha_fin<=today)throw new HttpError(422,'INVALID_VALIDITY','La fecha de fin debe ser posterior a hoy');
    const willBeActive=!next.fecha_fin||next.fecha_fin>today;
    const person=await repo.person(db,next.id_persona);if(!person||(!person.activo&&willBeActive))throw new HttpError(422,'INVALID_PERSON','Selecciona una persona activa');
    if(next.restriccion_judicial){if(next.puede_recoger)throw new HttpError(422,'JUDICIAL_RESTRICTION','Una persona con restricción judicial no puede recoger');if(!next.id_documento_restriccion||!await repo.restrictionDoc(db,next.id_documento_restriccion,child))throw new HttpError(422,'RESTRICTION_DOCUMENT_REQUIRED','Requiere respaldo judicial validado del mismo menor');}
    const links=(await repo.links(db,child)).filter(v=>active(v,today)&&v.id_vinculo!==Number(id));const policy=await repo.policy(db);
    if(willBeActive){if(links.some(v=>v.id_persona===next.id_persona))throw new HttpError(409,'DUPLICATE_LINK','La persona ya tiene un vínculo vigente');const max=next.tipo==='AUXILIAR'?policy.max_auxiliares:policy.max_principales;if(links.filter(v=>v.tipo===next.tipo).length>=max)throw new HttpError(422,'AUTHORIZED_LIMIT',`Se alcanzó el límite de ${max} personas ${next.tipo.toLowerCase()}`);}
    if(id)await repo.updateLink(db,id,next);else id=await repo.insertLink(db,child,next,today);
    await audit(db,actor,'menor_persona',id,before?'ACTUALIZAR':'CREAR',{id_menor:child,id_persona:next.id_persona,tipo:next.tipo,puede_recoger:Boolean(next.puede_recoger),restriccion_judicial:Boolean(next.restriccion_judicial),vigente:willBeActive,fecha_fin:next.fecha_fin});
    return (await repo.links(db,child)).find(v=>v.id_vinculo===Number(id));
  });}
  return {
    people:role=>repo.people(pool,role==='ADMIN'),
    createPerson:async(input,actor)=>transaction(pool,async db=>{await lockAdministration(db);const id=await repo.insertPerson(db,input);await audit(db,actor,'personas',id,'CREAR');return repo.person(db,id);}),
    updatePerson:async(id,input,actor)=>transaction(pool,async db=>{await lockAdministration(db);const before=await repo.person(db,id);if(!before)throw new HttpError(404,'NOT_FOUND','Persona no encontrada');await repo.updatePerson(db,id,{...before,...input});const after=await repo.person(db,id);await audit(db,actor,'personas',id,'ACTUALIZAR',{antes:before,despues:after,campos:Object.keys(input)});return after;}),
    linkMother:(child,input,actor)=>transaction(pool,async db=>{
      await lockAdministration(db);const record=await requireChild(db,child,true);if(!record.id_preinscripcion)throw new HttpError(409,'NO_PREINSCRIPTION','El expediente no tiene una solicitud prenatal vinculada');
      const pre=await repo.preinscriptionForChild(db,child);if(!pre||pre.estado!=='CONFIRMADA')throw new HttpError(409,'PREINSCRIPTION_UNAVAILABLE','La solicitud prenatal no está disponible');
      let personId=input.id_persona,created=false;
      if(personId){const person=await repo.person(db,personId);if(!person||!person.activo)throw new HttpError(422,'INVALID_PERSON','Selecciona una persona activa');}
      else{personId=await repo.insertPerson(db,{nombre:pre.nombre_contacto,telefono:pre.telefono_contacto,email:pre.email_contacto,tipo_identificacion:null});created=true;}
      const today=civilDate(),links=(await repo.links(db,child)).filter(v=>active(v,today)),policy=await repo.policy(db);
      if(links.some(v=>Number(v.id_persona)===Number(personId)))throw new HttpError(409,'DUPLICATE_LINK','La persona ya está vinculada a este menor');
      if(links.filter(v=>v.tipo==='PRINCIPAL').length>=policy.max_principales)throw new HttpError(422,'AUTHORIZED_LIMIT',`Se alcanzó el límite de ${policy.max_principales} personas principales`);
      const link={id_persona:personId,tipo:'PRINCIPAL',parentesco:'Madre',puede_recoger:input.puede_recoger,restriccion_judicial:false,id_documento_restriccion:null,fecha_fin:null};
      const linkId=await repo.insertLink(db,child,link,today);if(created)await audit(db,actor,'personas',personId,'CREAR_DESDE_PREINSCRIPCION',{id_preinscripcion:record.id_preinscripcion});
      await audit(db,actor,'menor_persona',linkId,'CREAR',{id_menor:Number(child),id_persona:Number(personId),tipo:'PRINCIPAL',parentesco:'Madre',puede_recoger:input.puede_recoger,identidad_confirmada:true,id_preinscripcion:record.id_preinscripcion});
      return (await repo.links(db,child)).find(v=>Number(v.id_vinculo)===Number(linkId));
    }),
    list:async id=>{await requireChild(pool,id);return {autorizados:(await repo.links(pool,id)).map(v=>({...v,vigente:active(v,civilDate())})),gafetes:await repo.badges(pool,id)};},
    link:(child,input,actor)=>saveLink(child,null,input,actor),updateLink:(child,id,input,actor)=>saveLink(child,id,input,actor),
    badge:async(child,actor)=>transaction(pool,async db=>{await lockAdministration(db);await requireChild(db,child,true);const list=await repo.badges(db,child);const policy=await repo.policy(db);const max=Math.min(policy.max_gafetes,3);const number=Array.from({length:max},(_,i)=>i+1).find(n=>!list.some(b=>b.numero===n));if(!number)throw new HttpError(422,'BADGE_LIMIT','No hay números de gafete disponibles; se conservan los emitidos');const code=randomBytes(24).toString('hex');const id=await repo.insertBadge(db,child,number,createHash('sha256').update(code).digest('hex'));await audit(db,actor,'gafetes',id,'EMITIR',{id_menor:child,numero:number});return {id_gafete:id,numero:number,codigo:code,estado:'ACTIVO',aviso:'Guarda el código ahora; no se vuelve a mostrar'};}),
    badgeState:async(child,id,state,actor)=>transaction(pool,async db=>{await lockAdministration(db);await requireChild(db,child,true);if(!await repo.setBadgeState(db,child,id,state))throw new HttpError(404,'NOT_FOUND','Gafete no encontrado para este menor');await audit(db,actor,'gafetes',id,'CAMBIAR_ESTADO',{id_menor:child,estado:state});return {id_gafete:Number(id),estado:state};}),
  };
}
