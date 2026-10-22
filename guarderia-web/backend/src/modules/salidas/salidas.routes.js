import {Router} from 'express';
import {validate,idParam} from '../../utils/http.js';
import {exitSchema} from './salidas.validation.js';
import {salidasController} from './salidas.controller.js';
export function salidasRoutes(s){const r=Router(),c=salidasController(s);r.get('/salidas',c.list);r.get('/salidas/:id',idParam,c.detail);r.post('/salida',validate(exitSchema),c.exit);return r;}
