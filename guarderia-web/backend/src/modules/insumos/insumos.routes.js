import {Router} from 'express';
import {validate,idParam} from '../../utils/http.js';
import {allowRoles} from '../../middlewares/security.js';
import {requirementsSchema,movementSchema,noticeSchema} from './insumos.validation.js';
import {insumosController} from './insumos.controller.js';
export function insumosRoutes(s){const r=Router(),c=insumosController(s);r.get('/tipos',c.types);r.get('/menor/:id',allowRoles('ADMIN','RECEPCION'),idParam,c.list);r.put('/menor/:id/requerimientos',allowRoles('ADMIN'),idParam,validate(requirementsSchema),c.requirements);r.post('/movimientos',validate(movementSchema),c.entry);r.post('/avisos',validate(noticeSchema),c.notice);return r;}
