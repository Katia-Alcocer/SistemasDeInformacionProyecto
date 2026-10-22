import {ok} from '../../utils/http.js';
export const medicamentosController=service=>({list:async(q,r)=>ok(r,await service.list(q.session.user)),resolve:async(q,r)=>ok(r,await service.resolve(q.params.id,q.body,q.get('Idempotency-Key'),q.session.user))});
