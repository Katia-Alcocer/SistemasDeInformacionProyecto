export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export const ok = (res, data, status = 200) => res.status(status).json({data, message:'Operación realizada', error:null});
export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(new HttpError(400,'INVALID_PAYLOAD','Revisa los campos enviados'));
    req.body = result.data; next();
  };
}
export function idParam(req, _res, next) {
  if (!/^[1-9]\d{0,14}$/.test(req.params.id)) return next(new HttpError(400,'INVALID_ID','Identificador inválido'));
  next();
}
