import {z} from 'zod';
export const password = z.string().min(12).max(72).refine(v=>Buffer.byteLength(v,'utf8')<=72);
const base=z.object({nombre:z.string().trim().min(2).max(160),email:z.string().trim().email().max(190).toLowerCase(),rol:z.enum(['ADMIN','RECEPCION','EDUCADORA','ENFERMERIA']),password,activo:z.boolean()}).strict();
export const userSchema=base.extend({activo:z.boolean().default(true)});
export const updateUserSchema=base.partial().refine(v=>Object.keys(v).length>0);
