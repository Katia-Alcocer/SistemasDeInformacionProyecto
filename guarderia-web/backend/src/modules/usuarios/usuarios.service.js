import bcrypt from 'bcryptjs';
import * as repo from './usuarios.repository.js';
import {publicUser} from '../auth/auth.repository.js';
import {HttpError} from '../../utils/http.js';
import {transaction,lockAdministration,audit,civilDate} from '../../utils/transaction.js';
export function usuariosService(pool) {
  return {
    list:async()=> (await repo.list(pool)).map(publicUser),
    create:async(input,actor,options={})=>{
      const hash=await bcrypt.hash(input.password,12);
      return transaction(pool,async db=>{
        await lockAdministration(db);
        if(options.bootstrap && await repo.adminCount(db)>0)throw new HttpError(409,'ADMIN_EXISTS','Ya existe un ADMIN activo');
        const id=await repo.insert(db,input,hash);
        const after=publicUser(await repo.find(db,id));
        await audit(db,actor,'usuarios',id,'CREAR',{despues:after});return after;
      });
    },
    update:async(id,input,actor)=>{
      const hash=input.password?await bcrypt.hash(input.password,12):null;
      return transaction(pool,async db=>{
        await lockAdministration(db);
        const previous=await repo.find(db,id);
        if(!previous)throw new HttpError(404,'NOT_FOUND','Usuario no encontrado');
        const next={...previous,...input};
        if(previous.rol==='ADMIN' && previous.activo && (!next.activo || next.rol!=='ADMIN') && await repo.adminCount(db)<=1) throw new HttpError(409,'LAST_ADMIN','Debe permanecer al menos un ADMIN activo');
        if((!next.activo || next.rol!=='EDUCADORA') && await repo.isResponsible(db,id,civilDate())) throw new HttpError(409,'ASSIGNED_RESPONSIBLE','Reasigna primero los grupos de esta educadora');
        await repo.update(db,id,next,hash||previous.password_hash);
        const after=publicUser(await repo.find(db,id));
        await audit(db,actor,'usuarios',id,'ACTUALIZAR',{antes:publicUser(previous),despues:after,credencial_modificada:Boolean(hash)});return after;
      });
    },
  };
}
