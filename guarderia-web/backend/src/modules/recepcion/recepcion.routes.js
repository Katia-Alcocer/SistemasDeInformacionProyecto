import {Router} from 'express';
import {validate} from '../../utils/http.js';
import {intakeSchema} from './recepcion.validation.js';
import {recepcionController} from './recepcion.controller.js';
export function recepcionRoutes(s){const r=Router(),c=recepcionController(s);r.get('/menor/:codigo',c.lookup);r.post('/ingreso',validate(intakeSchema),c.intake);return r;}
