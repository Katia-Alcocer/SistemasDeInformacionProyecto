import {z} from 'zod';
import {positiveId} from '../menores/menores.validation.js';
import {validDate} from '../../utils/dates.js';
export const money=z.string().regex(/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/);
export const cents=value=>{const [whole,fraction='']=value.split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));};
export const decimal=value=>`${Math.floor(value/100)}.${String(value%100).padStart(2,'0')}`;
const date=z.string().refine(v=>validDate(v)&&v>='2000-01-01');
export const feeSchema=z.object({id_menor:positiveId,periodo_inicio:date,periodo_fin:date,vencimiento:date,importe:money,confirmacion:z.literal(true)}).strict();
export const paymentSchema=z.object({id_cuota:positiveId,importe:money.refine(v=>cents(v)>0),metodo:z.enum(['EFECTIVO','TRANSFERENCIA','TARJETA','OTRO']),referencia:z.string().trim().max(150).nullable().default(null),confirmacion:z.literal(true)}).strict();
