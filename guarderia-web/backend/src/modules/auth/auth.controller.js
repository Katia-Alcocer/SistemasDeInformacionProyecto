import {ok} from '../../utils/http.js';
import {csrfToken} from './auth.service.js';
export function authController(service,config) {
  const cookie={httpOnly:true,secure:config.secure,sameSite:'lax',path:'/'};
  return {
    login:async(req,res)=>{const result=await service.login(req.body);res.cookie('guarderia_session',result.token,{...cookie,maxAge:8*60*60*1000});ok(res,{user:result.user,csrfToken:result.csrf});},
    me:(req,res)=>ok(res,{user:req.session.user,csrfToken:csrfToken(req.session.jti,config.secret)}),
    logout:async(req,res)=>{await service.logout(req.session);res.clearCookie('guarderia_session',cookie);res.status(204).end();},
  };
}
