import * as repo from './recetas.repository.js';
import {privateStorage} from '../documentos/storage.js';
import {requireChild} from '../menores/menores.service.js';
import {HttpError} from '../../utils/http.js';
import {transaction,lockAdministration,audit,civilDate} from '../../utils/transaction.js';
import {ensureScheduledDoses} from '../medicamentos/medicamentos.planning.js';
import {operationalTime} from '../../utils/clock.js';
export function recetasService(pool,config){const storage=privateStorage(config);return {
  children:()=>repo.children(pool),
  list:async child=>{await requireChild(pool,child);return {recetas:await repo.list(pool,child),restricciones:await repo.restrictions(pool,child)};},
  create:async(input,actor)=>transaction(pool,async db=>{
    await lockAdministration(db);await requireChild(db,input.id_menor,true);if(input.fecha_consulta>civilDate())throw new HttpError(422,'FUTURE_CONSULTATION','La consulta no puede tener fecha futura');
    const doc=await repo.document(db,input.id_menor,input.id_documento);if(!doc)throw new HttpError(422,'MEDICAL_DOCUMENT_REQUIRED','Selecciona un documento médico del mismo menor');await storage.read(doc.ruta_segura,doc.hash_sha256);await repo.validateDocument(db,input.id_documento,actor);
    const id=await repo.insert(db,input,actor);for(const t of input.tratamientos)await repo.treatment(db,id,t);for(const d of input.restricciones)await repo.restriction(db,input.id_menor,id,d);
    const [policy]=await db.query('SELECT zona_horaria FROM configuracion_operativa WHERE id_config=1');await ensureScheduledDoses(db,operationalTime(config.clock?config.clock():new Date(),policy[0].zona_horaria).date,actor);
    await audit(db,actor,'recetas',id,'CREAR_REVISADA',{id_menor:input.id_menor,id_documento:input.id_documento,permite_convivencia:input.permite_convivencia,tratamientos:input.tratamientos.length,restricciones:input.restricciones.length});return (await repo.list(db,input.id_menor)).find(r=>r.id_receta===id);
  }),
  dispenser:async(id,input,actor)=>transaction(pool,async db=>{await lockAdministration(db);const t=await repo.findTreatment(db,id);if(!t)throw new HttpError(404,'NOT_FOUND','Tratamiento no encontrado');if(input.entregado&&input.tipo!=='GRADUADO')throw new HttpError(422,'GRADUATED_DISPENSER_REQUIRED','Solo cumple un dosificador graduado; una cuchara convencional no cumple');if(!input.entregado&&input.tipo==='GRADUADO')throw new HttpError(400,'INVALID_DISPENSER','Confirma si se entregó o no el dosificador');await repo.dispenser(db,id,input.entregado);await audit(db,actor,'tratamientos',id,'DOSIFICADOR',{id_menor:t.id_menor,antes:Boolean(t.dosificador_entregado),despues:input.entregado,tipo:input.tipo});return {id_tratamiento:Number(id),dosificador_entregado:input.entregado};}),
  allergy:async(input,actor)=>transaction(pool,async db=>{await lockAdministration(db);await requireChild(db,input.id_menor,true);const id=await repo.restriction(db,input.id_menor,null,{tipo:'ALERGIA_BASE',descripcion:input.descripcion,inicio:input.inicio,fin:null});await audit(db,actor,'restricciones_alimentarias',id,'REGISTRAR_ALERGIA_BASE',{id_menor:input.id_menor});return {id_restriccion:id,tipo:'ALERGIA_BASE'};}),
};}
