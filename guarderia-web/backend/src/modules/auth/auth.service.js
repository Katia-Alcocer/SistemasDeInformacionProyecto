import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {randomBytes,createHash,createHmac} from 'node:crypto';
import {HttpError} from '../../utils/http.js';
import {transaction,audit} from '../../utils/transaction.js';
import * as repository from './auth.repository.js';
export const digest = value => createHash('sha256').update(value).digest('hex');
const dummyHash = bcrypt.hashSync('dummy-password-never-used-for-login',12);
export function csrfToken(jti,secret) { return createHmac('sha256',secret).update(`csrf:${jti}`).digest('hex'); }
export function authService(pool,config) {
  return {
    async login(input) {
      const candidate = await repository.userByEmail(pool,input.email);
      const valid = await bcrypt.compare(input.password,candidate?.password_hash || dummyHash);
      if (!valid || !candidate?.activo || candidate.deleted_at) throw new HttpError(401,'INVALID_CREDENTIALS','Correo o contraseña incorrectos');
      return transaction(pool,async db => {
        const user = await repository.userByEmail(db,input.email,true);
        if (!user?.activo || user.deleted_at || user.password_hash!==candidate.password_hash) throw new HttpError(401,'INVALID_CREDENTIALS','Correo o contraseña incorrectos');
        const jti = randomBytes(32).toString('hex');
        const token = jwt.sign({},config.secret,{algorithm:'HS256',subject:String(user.id_usuario),jwtid:jti,expiresIn:'8h',issuer:'guarderia',audience:'guarderia-web'});
        await repository.addSession(db,user.id_usuario,digest(jti));
        await audit(db,user.id_usuario,'usuarios',user.id_usuario,'LOGIN');
        return {token,user:repository.publicUser(user),csrf:csrfToken(jti,config.secret)};
      });
    },
    async authenticate(token) {
      let claims;
      try {claims=jwt.verify(token,config.secret,{algorithms:['HS256'],issuer:'guarderia',audience:'guarderia-web'});}
      catch {throw new HttpError(401,'UNAUTHENTICATED','Inicia sesión para continuar');}
      if (!claims.jti || !claims.sub) throw new HttpError(401,'UNAUTHENTICATED','Sesión inválida');
      const user=await repository.activeSession(pool,claims.sub,digest(claims.jti));
      if (!user) throw new HttpError(401,'UNAUTHENTICATED','La sesión expiró o fue revocada');
      return {user:repository.publicUser(user),jti:claims.jti};
    },
    async logout(session) {
      await transaction(pool,async db => {
        await repository.revokeSession(db,digest(session.jti));
        await audit(db,session.user.id_usuario,'usuarios',session.user.id_usuario,'LOGOUT');
      });
    },
  };
}
