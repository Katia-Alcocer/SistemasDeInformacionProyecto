import {Router} from 'express';
import {validate,idParam,ok} from '../../utils/http.js';
import {consumptionSchema,noticeSchema} from '../insumos/insumos.validation.js';
import {aulasController} from './aulas.controller.js';
import {activitySchema} from './aulas.validation.js';
export function aulasRoutes(service,inventory){const r=Router(),c=aulasController(service);
  r.get('/grupos',c.groups);r.get('/grupos/:id/insumos',idParam,c.monitor);
  r.get('/grupos/:id/actividades',idParam,c.activities);r.post('/grupos/:id/actividades',idParam,validate(activitySchema),c.createActivity);
  r.put('/insumos/descontar',validate(consumptionSchema),async(q,res)=>ok(res,await inventory.movement(q.body,q.get('Idempotency-Key'),q.session.user,true),201));
  r.post('/insumos/avisos',validate(noticeSchema),async(q,res)=>ok(res,await inventory.notice(q.body,q.session.user,true),201));return r;
}
