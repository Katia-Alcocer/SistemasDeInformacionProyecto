import {Router,raw} from 'express';
import {idParam,validate} from '../../utils/http.js';
import {recipeSchema,allergySchema,dispenserSchema} from './recetas.validation.js';
import {recetasController} from './recetas.controller.js';
export function recetasRoutes(service,documents){const r=Router(),c=recetasController(service,documents);r.get('/menores',c.children);r.get('/menor/:id',idParam,c.list);r.post('/',validate(recipeSchema),c.create);r.post('/restricciones-base',validate(allergySchema),c.allergy);
  r.post('/documentos/:id',idParam,raw({type:['application/pdf','image/png','image/jpeg'],limit:'2mb'}),c.uploadDocument);
  r.get('/documentos/:id/:documentId',idParam,c.downloadDocument);
  return r;
}
export function dosificadorRoutes(service){const r=Router(),c=recetasController(service);r.patch('/tratamientos/:id/dosificador',idParam,validate(dispenserSchema),c.dispenser);return r;}
