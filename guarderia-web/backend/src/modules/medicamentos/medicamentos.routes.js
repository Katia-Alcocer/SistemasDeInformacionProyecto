import {Router} from 'express';
import {validate,idParam,ok} from '../../utils/http.js';
import {doseSchema,suspensionSchema} from './medicamentos.validation.js';
import {medicamentosController} from './medicamentos.controller.js';
export function medicamentosRoutes(service){const r=Router(),c=medicamentosController(service);r.get('/dosis',c.list);r.post('/dosis/:id/registro',idParam,validate(doseSchema),c.resolve);r.post('/tratamientos/:id/suspension',idParam,validate(suspensionSchema),async(q,res)=>ok(res,await service.suspend(q.params.id,q.body,q.session.user)));return r;}
