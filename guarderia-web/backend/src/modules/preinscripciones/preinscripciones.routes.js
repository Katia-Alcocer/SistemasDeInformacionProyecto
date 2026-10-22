import {Router} from 'express';
import {validate,idParam} from '../../utils/http.js';
import {preSchema,prePatch} from './preinscripciones.validation.js';
import {preinscripcionesController} from './preinscripciones.controller.js';
export function preinscripcionesRoutes(s){const r=Router(),c=preinscripcionesController(s);r.get('/',c.list);r.post('/',validate(preSchema),c.create);r.patch('/:id',idParam,validate(prePatch),c.update);return r;}
