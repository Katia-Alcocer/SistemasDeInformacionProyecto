import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {validate} from '../../utils/http.js';
import {loginSchema} from './auth.validation.js';
import {authController} from './auth.controller.js';
import {authenticate,csrf} from '../../middlewares/security.js';
export function authRoutes(service,config) {
  const router=Router(), c=authController(service,config);
  router.post('/login',rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,message:{data:null,message:'Demasiados intentos; vuelve a intentarlo más tarde',error:{code:'RATE_LIMITED'}}}),validate(loginSchema),c.login);
  router.get('/me',authenticate(service),c.me);
  router.post('/logout',authenticate(service),csrf(config),c.logout);
  return router;
}
