import {Router,raw} from 'express';
import {z} from 'zod';
import {idParam,validate,HttpError} from '../../utils/http.js';
import {documentosController} from './documentos.controller.js';
const file=raw({type:['application/pdf','image/png','image/jpeg'],limit:'2mb'});
const requireFile=(q,_r,next)=>Buffer.isBuffer(q.body)?next():next(new HttpError(415,'UNSUPPORTED_MEDIA','Envía un PDF, PNG o JPEG como cuerpo binario'));
const docId=(q,_r,next)=>/^[1-9]\d{0,14}$/.test(q.params.documentId)?next():next(new HttpError(400,'INVALID_ID','Identificador inválido'));
const type=(q,_r,next)=>['ACTA_NACIMIENTO','CURP','OTRO'].includes(q.get('X-Document-Type'))?next():next(new HttpError(400,'DOCUMENT_TYPE','Especifica X-Document-Type: ACTA_NACIMIENTO, CURP u OTRO'));
export function documentosRoutes(s,guard){const r=Router(),c=documentosController(s);r.use('/:id/documentos',...guard);r.post('/:id/documentos',idParam,type,file,requireFile,c.upload);r.patch('/:id/documentos/:documentId',idParam,docId,validate(z.object({validado:z.boolean()}).strict()),c.review);r.get('/:id/documentos/:documentId',idParam,docId,c.download);return r;}
export function identidadRoutes(s,guard){const r=Router(),c=documentosController(s);r.use('/:id/identificacion',...guard);r.post('/:id/identificacion',idParam,file,requireFile,c.uploadIdentity);r.get('/:id/identificacion',idParam,c.downloadIdentity);return r;}
