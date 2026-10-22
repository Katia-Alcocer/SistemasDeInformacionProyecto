import {ok} from '../../utils/http.js';
export const gruposController=s=>({list:async(_req,res)=>ok(res,await s.list()),categories:async(_req,res)=>ok(res,await s.categories()),create:async(req,res)=>ok(res,await s.create(req.body,req.session.user.id_usuario),201),update:async(req,res)=>ok(res,await s.update(req.params.id,req.body,req.session.user.id_usuario))});
