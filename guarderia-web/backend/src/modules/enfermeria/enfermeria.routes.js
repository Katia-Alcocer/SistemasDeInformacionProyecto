import {Router} from 'express';
import {idParam,validate} from '../../utils/http.js';
import {allowRoles} from '../../middlewares/security.js';
import {careSchema,measurementSchema,contactSchema,closeSchema} from './enfermeria.validation.js';
import {enfermeriaController} from './enfermeria.controller.js';
export function enfermeriaRoutes(service){const r=Router(),c=enfermeriaController(service);r.get('/recolecciones',c.alerts);r.patch('/recolecciones/:id/contacto',idParam,validate(contactSchema),c.contact);r.use(allowRoles('ADMIN','ENFERMERIA'));r.get('/menores',c.children);r.get('/menores/:id',idParam,c.detail);r.get('/cobertura',c.coverage);r.post('/atenciones',validate(careSchema),c.care);r.post('/mediciones',validate(measurementSchema),c.measure);r.patch('/recolecciones/:id/cierre',idParam,validate(closeSchema),c.close);return r;}
