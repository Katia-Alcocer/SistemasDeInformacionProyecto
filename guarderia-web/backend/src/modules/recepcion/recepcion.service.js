import * as repo from './recepcion.repository.js';
import * as children from '../menores/menores.repository.js';
import * as supplies from '../insumos/insumos.repository.js';
import {requireChild,presentChild} from '../menores/menores.service.js';
import {privateStorage} from '../documentos/storage.js';
import {ageCategory,addMonths} from '../../utils/dates.js';
import {operationalTime} from '../../utils/clock.js';
import {transaction,lockAdministration,audit} from '../../utils/transaction.js';
import {HttpError} from '../../utils/http.js';
import {ensureScheduledDoses} from '../medicamentos/medicamentos.planning.js';
export function recepcionService(pool,config){const now=config.clock||(()=>new Date()),storage=privateStorage(config);
  return {
    lookup:async(value,type,actor)=>transaction(pool,async db=>{
      if(!['CODIGO','ID'].includes(type)||!value||value.length>40||(type==='ID'&&!/^[1-9]\d{0,14}$/.test(value)))throw new HttpError(400,'INVALID_LOOKUP','Indica código o ID válido');
      const found=await repo.lookup(db,value,type);if(!found)throw new HttpError(404,'NOT_FOUND','Menor no encontrado');
      const policy=await repo.policy(db),clock=operationalTime(now(),policy.zona_horaria),child=await requireChild(db,found.id_menor);
      const prescriptions=await repo.recipes(db,child.id_menor,clock.date);
      const data={menor:presentChild(child),hora_servidor:clock.time,fecha_operativa:clock.date,ventana:{inicio:policy.hora_inicio_ingreso,fin_exclusivo:policy.hora_fin_ingreso},area_requerida:clock.date<addMonths(child.fecha_nacimiento,12)?'CUNERO':'GENERAL',autorizados:await repo.authorized(db,child.id_menor,clock.date),lesiones_previas:await repo.priorLesions(db,child.id_menor),intentos:await repo.attempts(db,child.id_menor),tratamientos:await repo.treatments(db,child.id_menor,clock.date),restricciones:await repo.restrictions(db,child.id_menor,clock.date),recetas:prescriptions.map(r=>({id_receta:r.id_receta,permite_convivencia:Boolean(r.permite_convivencia),vigencia_inicio:r.vigencia_inicio,vigencia_fin:r.vigencia_fin,verificada:Boolean(r.verificada_por&&r.documento_validado)})),insumos:await supplies.stock(db,child.id_menor),insumos_revisados:await supplies.reviewed(db,child.id_menor)};
      await audit(db,actor,'menores',child.id_menor,'CONSULTAR_FICHA_RECEPCION');return data;
    }),
    intake:async(input,actor)=>transaction(pool,async db=>{
      await lockAdministration(db);const child=await requireChild(db,input.id_menor,true),policy=await repo.policy(db),clock=operationalTime(now(),policy.zona_horaria);
      const reasons=[];const reject=(codigo,mensaje)=>reasons.push({codigo,mensaje});
      if(child.estatus!=='ACTIVO'||child.deleted_at)reject('MENOR_INACTIVO','El expediente no tiene inscripción activa');
      const category=ageCategory(child.fecha_nacimiento,clock.date);const days=(Date.parse(`${clock.date}T00:00:00Z`)-Date.parse(`${child.fecha_nacimiento}T00:00:00Z`))/86400000;
      if(!category||days<Math.max(30,policy.edad_minima_dias))reject('EDAD_NO_ADMISIBLE','Requiere al menos 30 días y menos de cuatro años');
      if(clock.time<policy.hora_inicio_ingreso||clock.time>=policy.hora_fin_ingreso)reject('FUERA_DE_HORARIO','El intento está fuera de la ventana de recepción');
      if(!child.curp||!child.registro_civil_validado||!await repo.documentsValid(db,child.id_menor))reject('EXPEDIENTE_INCOMPLETO','Falta CURP, revisión civil o documentos obligatorios validados');
      const assignments=await children.currentGroup(db,child.id_menor,clock.date);const group=assignments.length===1?await children.group(db,assignments[0].id_grupo,clock.date):null;
      if(!group||group.categoria!==category)reject('GRUPO_NO_COMPATIBLE','Revisa grupo, categoría por cumpleaños y responsable');
      if(await repo.duplicate(db,child.id_menor,clock.date))reject('ASISTENCIA_DUPLICADA','El menor ya tiene asistencia de este día');
      const expectedArea=clock.date<addMonths(child.fecha_nacimiento,12)?'CUNERO':'GENERAL';
      if(!input.inspeccion.confirmada)reject('INSPECCION_REQUERIDA','Confirma la inspección física antes del ingreso');
      if(input.inspeccion.area!==expectedArea)reject('AREA_INCORRECTA',`La inspección corresponde a ${expectedArea}`);
      const prior=await repo.priorLesions(db,child.id_menor),references=input.inspeccion.lesiones.map(l=>l.id_lesion_anterior).filter(Boolean);
      const referencesValid=references.every(id=>prior.some(l=>l.id_lesion===id));
      if(!referencesValid)reject('SEGUIMIENTO_INVALIDO','La lesión previa debe estar abierta y pertenecer al mismo menor');
      if(prior.some(l=>!references.includes(l.id_lesion)))reject('SEGUIMIENTO_PENDIENTE','Registra seguimiento de todas las lesiones abiertas');
      const recipes=await repo.recipes(db,child.id_menor,clock.date);const validRecipes=[];
      for(const r of recipes){let valid=Boolean(r.verificada_por&&r.documento_validado&&r.ruta_segura);if(valid)try{await storage.read(r.ruta_segura,r.hash_sha256);}catch{valid=false;}if(valid)validRecipes.push(r);else reject('RECETA_NO_VERIFICABLE','Enfermería debe revisar el documento médico vigente');}
      if(input.indicio_contagio||validRecipes.some(r=>!r.permite_convivencia))reject('CONVIVENCIA_INCOMPATIBLE','No se autoriza convivencia con población general');
      if(input.sintomas&&!validRecipes.some(r=>r.permite_convivencia))reject('RECETA_CONVIVENCIA_REQUERIDA','Síntomas requieren receta vigente revisada con convivencia explícita');
      const treatments=await repo.treatments(db,child.id_menor,clock.date),validIds=new Set(validRecipes.map(r=>r.id_receta));
      if(treatments.some(t=>!validIds.has(t.id_receta))||(input.requiere_tratamiento&&!treatments.length))reject('TRATAMIENTO_SIN_RESPALDO','El tratamiento requiere receta revisada y vigente');
      if(treatments.some(t=>t.dosificador_requerido&&!t.dosificador_entregado))reject('DOSIFICADOR_FALTANTE','Falta dosificador graduado para un tratamiento vigente');
      const diets=await repo.restrictions(db,child.id_menor,clock.date);
      if(input.dieta_temporal_requerida&&!diets.some(d=>d.tipo==='DIETA_MEDICA_TEMPORAL'&&validIds.has(d.id_receta)))reject('DIETA_SIN_RESPALDO','La dieta temporal requiere receta y vigencia actual');
      if(!await supplies.reviewed(db,child.id_menor))reject('INSUMOS_NO_REVISADOS','ADMIN debe revisar requisitos individuales de insumos');
      const stock=await supplies.stock(db,child.id_menor,true);
      for(const item of stock)if(item.obligatorio&&Number(item.cantidad_actual)<Number(item.cantidad_requerida_ingreso))reject('INSUMO_INSUFICIENTE',`Falta mínimo obligatorio de ${item.nombre}`);
      const attempt=await repo.insertAttempt(db,input,actor,clock,reasons);let inspection=null;if(input.inspeccion.confirmada&&referencesValid)inspection=await repo.inspection(db,attempt,input,clock);
      const attendance=reasons.length?null:await repo.attendance(db,child.id_menor,attempt,clock);
      if(attendance)await ensureScheduledDoses(db,clock.date,actor);
      await audit(db,actor,'intentos_ingreso',attempt,reasons.length?'RECHAZAR_INGRESO':'ACEPTAR_INGRESO',{id_menor:child.id_menor,id_asistencia:attendance,id_inspeccion:inspection,motivos:reasons.map(r=>r.codigo),fecha_operativa:clock.date,filtro:{sintomas:input.sintomas,indicio_contagio:input.indicio_contagio,pendiente_relevante:input.pendiente_relevante,requiere_tratamiento:input.requiere_tratamiento,dieta_temporal_requerida:input.dieta_temporal_requerida}});
      return {id_intento:attempt,id_asistencia:attendance,resultado:reasons.length?'RECHAZADO':'ACEPTADO',motivos:reasons,fecha_operativa:clock.date,hora_servidor:clock.time};
    }),
  };
}
