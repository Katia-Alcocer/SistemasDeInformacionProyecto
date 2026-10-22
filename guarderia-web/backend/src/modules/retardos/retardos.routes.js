import {Router} from 'express';
import {z} from 'zod';
import {idParam,validate,ok} from '../../utils/http.js';
import {allowRoles} from '../../middlewares/security.js';
export function retardosRoutes(service){
 const r=Router();
 r.get('/',async(q,s)=>ok(s,await service.list(q.session.user.id_usuario)));
 r.get('/revisiones',allowRoles('ADMIN'),async(q,s)=>ok(s,await service.reviews(q.query.anio,q.session.user.id_usuario)));
 r.put('/:id/aviso',idParam,validate(z.object({justificacion:z.string().trim().min(3).max(2000),confirmacion:z.literal(true)}).strict()),async(q,s)=>ok(s,await service.notice(q.params.id,q.body,q.session.user.id_usuario)));
 r.put('/:id/decision',allowRoles('ADMIN'),idParam,validate(z.object({estado:z.enum(['APROBADO','RECHAZADO']),motivo:z.string().trim().min(3).max(2000),confirmacion:z.literal(true)}).strict()),async(q,s)=>ok(s,await service.decide(q.params.id,q.body,q.session.user.id_usuario)));
 return r;
}
