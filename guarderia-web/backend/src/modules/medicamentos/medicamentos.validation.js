import {z} from 'zod';
export const suspensionSchema=z.object({confirmacion:z.literal(true),motivo:z.string().trim().min(3).max(1000)}).strict();
export const doseSchema=z.object({estado:z.enum(['APLICADA','OMITIDA']),dosis_aplicada:z.number().positive().max(9999999.999).multipleOf(0.001).nullable().default(null),confirmacion_identidad:z.literal(true),confirmacion_prescripcion:z.literal(true),observaciones:z.string().trim().min(3).max(1000)}).strict().refine(v=>v.estado==='APLICADA'?v.dosis_aplicada!==null:v.dosis_aplicada===null);
