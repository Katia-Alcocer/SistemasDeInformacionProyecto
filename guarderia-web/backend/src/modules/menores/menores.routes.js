import {Router} from 'express';
import {validate,idParam} from '../../utils/http.js';
import {allowRoles} from '../../middlewares/security.js';
import {childSchema,updateChildSchema,activateSchema,reviewSchema,statusSchema} from './menores.validation.js';
import {menoresController} from './menores.controller.js';
export function menoresRoutes(service){const r=Router(),c=menoresController(service);r.get('/',c.list);r.get('/:id',idParam,c.detail);r.post('/',allowRoles('ADMIN'),validate(childSchema),c.create);r.patch('/:id',allowRoles('ADMIN'),idParam,validate(updateChildSchema),c.update);r.post('/:id/registro-civil',allowRoles('ADMIN'),idParam,validate(reviewSchema),c.review);r.post('/:id/activar',allowRoles('ADMIN'),idParam,validate(activateSchema),c.activate);r.post('/:id/estado',allowRoles('ADMIN'),idParam,validate(statusSchema),c.status);return r;}
