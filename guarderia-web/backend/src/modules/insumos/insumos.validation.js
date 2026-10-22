import {z} from 'zod';
import {positiveId} from '../menores/menores.validation.js';
export const quantity=z.number().min(0).max(999999999.999).multipleOf(0.001);
export const requirementsSchema=z.object({requerimientos:z.array(z.object({id_tipo_insumo:positiveId,cantidad_requerida_ingreso:quantity,obligatorio:z.boolean(),consumo_diario_estimado:quantity.positive().nullable().default(null)}).strict().refine(v=>!v.obligatorio||v.cantidad_requerida_ingreso>0)).max(50),confirmacion_sin_insumos:z.boolean().default(false)}).strict().refine(v=>v.requerimientos.length>0||v.confirmacion_sin_insumos).refine(v=>new Set(v.requerimientos.map(r=>r.id_tipo_insumo)).size===v.requerimientos.length);
export const entrySchema=z.object({id_insumo_menor:positiveId,tipo:z.literal('ENTRADA'),cantidad:quantity.positive(),motivo:z.string().trim().min(3).max(255)}).strict();
export const movementSchema=entrySchema.extend({tipo:z.enum(['ENTRADA','CONSUMO','AJUSTE']),cantidad:z.number().min(-999999999.999).max(999999999.999).multipleOf(0.001).refine(n=>n!==0)}).refine(v=>v.tipo==='AJUSTE'||v.cantidad>0);
export const consumptionSchema=entrySchema.extend({tipo:z.literal('CONSUMO')});
export const noticeSchema=z.object({id_insumo_menor:positiveId,dias_estimados:z.number().int().min(0).max(3),confirmacion_contacto:z.literal(true),observaciones:z.string().trim().min(3).max(255)}).strict();
