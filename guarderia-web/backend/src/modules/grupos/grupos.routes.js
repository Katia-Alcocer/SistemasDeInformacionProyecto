import {Router} from 'express';
import {validate,idParam} from '../../utils/http.js';
import {groupSchema,updateGroupSchema} from './grupos.validation.js';
import {gruposController} from './grupos.controller.js';
export function gruposRoutes(service){const r=Router(),c=gruposController(service);r.get('/',c.list);r.get('/categorias',c.categories);r.post('/',validate(groupSchema),c.create);r.patch('/:id',idParam,validate(updateGroupSchema),c.update);return r;}
