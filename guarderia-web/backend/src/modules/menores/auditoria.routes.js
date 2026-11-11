import {Router} from 'express';
import {idParam,ok} from '../../utils/http.js';

export function auditoriaRoutes(service){
 const r=Router();
 r.get('/menor/:id',idParam,async(q,res)=>{
  const data=await service.auditExport(q.params.id,q.session.user.id_usuario);
  res.set('Content-Disposition',`attachment; filename="auditoria-menor-${q.params.id}.json"`);
  return ok(res,data);
 });
 return r;
}
