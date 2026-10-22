import {Router} from 'express';
import {validate,idParam,ok} from '../../utils/http.js';
import {ingredientSchema,dishSchema,reviewSchema,withdrawSchema,transferSchema,exitSchema,mealSchema} from './comedor.validation.js';
import {comedorController} from './comedor.controller.js';
export function comedorRoutes(service){const r=Router(),c=comedorController(service);r.get('/catalogos',c.catalogs);r.get('/presentes',c.children);r.post('/ingredientes',validate(ingredientSchema),c.ingredient);r.post('/platillos',validate(dishSchema),c.dish);r.post('/restricciones/:id/revision',idParam,validate(reviewSchema),c.review);r.patch('/restricciones/:id/revision',idParam,validate(withdrawSchema),async(q,res)=>ok(res,await service.withdraw(q.params.id,q.body,q.session.user)));r.post('/traslados',validate(transferSchema),c.enter);r.patch('/traslados/:id/salida',idParam,validate(exitSchema),c.exit);r.post('/registros',validate(mealSchema),c.meal);return r;}
