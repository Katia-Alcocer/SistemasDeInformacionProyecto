import {z} from 'zod';
const id=z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const base=z.object({id_categoria:id,codigo:z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/),nombre:z.string().trim().min(2).max(100),capacidad:z.number().int().min(1).max(65535),activo:z.boolean(),id_responsable:id.nullable()}).strict();
export const groupSchema=base.extend({activo:z.boolean().default(false),id_responsable:id.nullable().default(null)});
export const updateGroupSchema=base.partial().refine(v=>Object.keys(v).length>0);
