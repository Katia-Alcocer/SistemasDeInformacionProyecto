import {Router} from 'express';
import {validate,idParam} from '../../utils/http.js';
import {userSchema,updateUserSchema} from './usuarios.validation.js';
import {usuariosController} from './usuarios.controller.js';
export function usuariosRoutes(service) {const r=Router(),c=usuariosController(service);r.get('/',c.list);r.post('/',validate(userSchema),c.create);r.patch('/:id',idParam,validate(updateUserSchema),c.update);return r;}
