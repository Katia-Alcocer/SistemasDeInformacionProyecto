import {z} from 'zod';
import {civil} from '../menores/menores.validation.js';
const base=z.object({nombre_contacto:z.string().trim().min(2).max(160),telefono_contacto:z.string().trim().min(7).max(30).regex(/^[+\d ()-]+$/),email_contacto:z.string().trim().email().max(190).nullable(),fecha_probable_parto:civil,posible_nombre_bebe:z.string().trim().max(160).nullable(),observaciones:z.string().trim().max(1000).nullable()}).strict();
export const preSchema=base.extend({email_contacto:base.shape.email_contacto.default(null),posible_nombre_bebe:base.shape.posible_nombre_bebe.default(null),observaciones:base.shape.observaciones.default(null)});
export const prePatch=base.partial().extend({estado:z.enum(['PENDIENTE','EN_ESPERA','CONFIRMADA','CANCELADA']).optional()}).refine(v=>Object.keys(v).length>0);
