import {z} from 'zod';
import {positiveId} from '../menores/menores.validation.js';
export const careSchema=z.object({id_menor:positiveId,id_asistencia:positiveId.nullable().default(null),motivo:z.string().trim().min(3).max(2000),acciones:z.string().trim().min(3).max(3000),requiere_recoleccion:z.boolean(),confirmacion:z.literal(true)}).strict();
export const measurementSchema=z.object({id_menor:positiveId,id_atencion:positiveId.nullable().default(null),tipo:z.enum(['MENSUAL','INCIDENTE']),peso_kg:z.number().positive().max(999.999).multipleOf(0.001),talla_cm:z.number().positive().max(9999.99).multipleOf(0.01),confirmacion_medicion:z.literal(true)}).strict().refine(v=>v.tipo==='MENSUAL'?v.id_atencion===null:v.id_atencion!==null);
export const contactSchema=z.object({confirmacion:z.literal(true),detalle:z.string().trim().min(3).max(1000)}).strict();
export const closeSchema=z.object({confirmacion:z.literal(true),motivo:z.string().trim().min(3).max(1000)}).strict();
