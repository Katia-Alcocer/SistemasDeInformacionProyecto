import {z} from 'zod';
import {positiveId} from '../menores/menores.validation.js';
export const exitSchema=z.object({id_asistencia:positiveId,id_vinculo:positiveId,id_alerta_recoleccion:positiveId.nullable().default(null),codigo_gafete:z.string().trim().regex(/^[a-fA-F0-9]{48}$/).transform(s=>s.toLowerCase()).nullable().default(null),identidad_verificada:z.literal(true),metodo_verificacion:z.enum(['DOCUMENTO','CHECK']),confirmacion:z.literal(true),observaciones:z.string().trim().min(3).max(1000),hora_salida:z.string().max(100).optional()}).strict();
