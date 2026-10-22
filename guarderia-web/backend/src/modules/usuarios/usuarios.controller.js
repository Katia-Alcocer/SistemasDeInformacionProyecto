import {ok} from '../../utils/http.js';
export const usuariosController=service=>({list:async(_req,res)=>ok(res,await service.list()),create:async(req,res)=>ok(res,await service.create(req.body,req.session.user.id_usuario),201),update:async(req,res)=>ok(res,await service.update(req.params.id,req.body,req.session.user.id_usuario))});
