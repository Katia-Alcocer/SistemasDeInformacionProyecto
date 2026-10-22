import {Router} from 'express';
import {z} from 'zod';
import {idParam,validate,ok} from '../../utils/http.js';
export function autoridadRoutes(service){const r=Router();r.get('/',async(q,s)=>ok(s,await service.list(q.query.fecha,q.session.user.id_usuario)));r.post('/generar',validate(z.object({confirmacion:z.literal(true)}).strict()),async(q,s)=>ok(s,await service.synchronize(q.session.user.id_usuario)));r.get('/:id',idParam,async(q,s)=>ok(s,await service.detail(q.params.id,q.session.user.id_usuario)));return r;}
