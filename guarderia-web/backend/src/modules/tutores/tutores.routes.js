import {Router} from 'express';
import {idParam,validate,HttpError} from '../../utils/http.js';
import {allowRoles} from '../../middlewares/security.js';
import {personSchema,personPatch,linkSchema,linkPatch,badgePatch} from './tutores.validation.js';
import {tutoresController} from './tutores.controller.js';
const secondary=name=>(q,_r,next)=>/^[1-9]\d{0,14}$/.test(q.params[name])?next():next(new HttpError(400,'INVALID_ID','Identificador inválido'));
export function personasRoutes(s){const r=Router(),c=tutoresController(s);r.get('/',c.people);r.post('/',allowRoles('ADMIN'),validate(personSchema),c.createPerson);r.patch('/:id',allowRoles('ADMIN'),idParam,validate(personPatch),c.updatePerson);return r;}
export function tutoresRoutes(s){const r=Router(),c=tutoresController(s);r.get('/:id/autorizados',idParam,c.list);r.post('/:id/autorizados',allowRoles('ADMIN'),idParam,validate(linkSchema),c.link);r.patch('/:id/autorizados/:linkId',allowRoles('ADMIN'),idParam,secondary('linkId'),validate(linkPatch),c.updateLink);r.post('/:id/gafetes',allowRoles('ADMIN'),idParam,validateEmpty,c.badge);r.patch('/:id/gafetes/:badgeId',allowRoles('ADMIN'),idParam,secondary('badgeId'),validate(badgePatch),c.badgeState);return r;}
function validateEmpty(q,_r,next){if(q.body&&Object.keys(q.body).length)return next(new HttpError(400,'INVALID_PAYLOAD','No se aceptan códigos o fechas enviados por el cliente'));next();}
