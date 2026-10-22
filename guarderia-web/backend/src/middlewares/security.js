import {timingSafeEqual} from 'node:crypto';
import {HttpError} from '../utils/http.js';
import {csrfToken} from '../modules/auth/auth.service.js';
export const authenticate = service => async (req,_res,next) => {
  try {req.session=await service.authenticate(req.cookies.guarderia_session); next();} catch(e){next(e);}
};
export const allowRoles = (...roles) => (req,_res,next) => roles.includes(req.session.user.rol) ? next() : next(new HttpError(403,'FORBIDDEN','No tienes permiso para esta operación'));
export const csrf = config => (req,_res,next) => {
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  const expected=csrfToken(req.session.jti,config.secret);
  const given=req.get('X-CSRF-Token') || '';
  if (Buffer.byteLength(given)!==Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(given),Buffer.from(expected))) return next(new HttpError(403,'CSRF_INVALID','La verificación de seguridad falló; vuelve a iniciar sesión'));
  next();
};
