import * as repo from './grupos.repository.js';
import {HttpError} from '../../utils/http.js';
import {transaction,lockAdministration,audit,civilDate} from '../../utils/transaction.js';
export function gruposService(pool){
  async function save(id,input,actor){return transaction(pool,async db=>{
    await lockAdministration(db);
    const today=civilDate();
    const before=id?await repo.find(db,id):null;
    if(id&&!before)throw new HttpError(404,'NOT_FOUND','Grupo no encontrado');
    const assignments=id?await repo.currentAssignment(db,id,today):[];
    if(assignments.length>1)throw new HttpError(409,'MULTIPLE_RESPONSIBLES','El grupo tiene asignaciones inconsistentes; requiere revisión');
    const currentTeacher=assignments[0]?.id_usuario||null;
    const next={...before,id_responsable:currentTeacher,...input};
    if(!await repo.categoryExists(db,next.id_categoria))throw new HttpError(422,'INVALID_CATEGORY','Categoría inexistente');
    if(next.id_responsable&&!await repo.teacher(db,next.id_responsable))throw new HttpError(422,'INVALID_TEACHER','La responsable debe ser una EDUCADORA activa');
    if(next.activo&&!next.id_responsable)throw new HttpError(422,'RESPONSIBLE_REQUIRED','Asigna una responsable antes de habilitar el grupo');
    const occupancy=id?await repo.occupancy(db,id,today):0;
    if(next.capacidad<occupancy)throw new HttpError(409,'CAPACITY_OCCUPIED','La capacidad no puede ser inferior a la ocupación');
    if(occupancy&&(!next.activo||next.id_categoria!==before.id_categoria))throw new HttpError(409,'GROUP_OCCUPIED','Reubica o cambia a pendiente los expedientes activos antes de desactivar o cambiar la categoría del grupo');
    if(id)await repo.update(db,id,next);else id=await repo.insert(db,next);
    if(currentTeacher!==next.id_responsable)await repo.assign(db,id,next.id_responsable,today);
    await audit(db,actor,'grupos',id,before?'ACTUALIZAR':'CREAR',{antes:before?{...before,id_responsable:currentTeacher}:null,despues:next});
    return (await repo.list(db,today)).find(g=>g.id_grupo===Number(id));
  });}
  return {list:()=>repo.list(pool,civilDate()),categories:()=>repo.categories(pool),create:(input,actor)=>save(null,input,actor),update:(id,input,actor)=>save(id,input,actor)};
}
