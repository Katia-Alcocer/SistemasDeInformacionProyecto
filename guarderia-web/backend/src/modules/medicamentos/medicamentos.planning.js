import {schedule} from './medicamentos.repository.js';
import {audit} from '../../utils/transaction.js';
// El llamador conserva la transacción y el bloqueo operativo hasta COMMIT.
export async function ensureScheduledDoses(db,date,actor=null){const count=await schedule(db,date);if(count)await audit(db,actor,'programacion_dosis',Number(date.replaceAll('-','')),'PROGRAMAR_DOSIS',{fecha:date,cantidad:count});return count;}
