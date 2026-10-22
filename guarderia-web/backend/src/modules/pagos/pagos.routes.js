import {Router} from 'express';
import {idParam,validate,ok} from '../../utils/http.js';
import {feeSchema,paymentSchema} from './pagos.validation.js';
export function cuotasRoutes(s){const r=Router();r.get('/',async(q,r)=>ok(r,await s.list(q.query.id_menor,q.session.user.id_usuario)));r.get('/:id',idParam,async(q,r)=>ok(r,await s.detail(q.params.id,q.session.user.id_usuario)));r.post('/',validate(feeSchema),async(q,r)=>ok(r,await s.create(q.body,q.get('Idempotency-Key'),q.session.user.id_usuario),201));return r;}
export function pagosRoutes(s){const r=Router();r.post('/',validate(paymentSchema),async(q,r)=>ok(r,await s.pay(q.body,q.get('Idempotency-Key'),q.session.user.id_usuario),201));r.get('/:id',idParam,async(q,r)=>ok(r,await s.receipt(q.params.id,q.session.user.id_usuario)));return r;}
