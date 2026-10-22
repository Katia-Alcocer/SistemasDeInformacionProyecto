import {ok} from '../../utils/http.js';
export const preinscripcionesController=s=>({list:async(_q,r)=>ok(r,await s.list()),create:async(q,r)=>ok(r,await s.create(q.body,q.session.user.id_usuario),201),update:async(q,r)=>ok(r,await s.update(q.params.id,q.body,q.session.user.id_usuario))});
