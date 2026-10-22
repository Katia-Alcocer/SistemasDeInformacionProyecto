import {z} from 'zod';
import {positiveId} from '../menores/menores.validation.js';
export const activitySchema=z.object({
  titulo:z.string().trim().min(3).max(160),
  descripcion:z.string().trim().max(2000).nullable().default(null),
  participantes:z.array(z.object({id_asistencia:positiveId,observaciones:z.string().trim().max(1000).nullable().default(null)}).strict()).min(1).max(200),
}).strict().refine(v=>new Set(v.participantes.map(p=>p.id_asistencia)).size===v.participantes.length);
