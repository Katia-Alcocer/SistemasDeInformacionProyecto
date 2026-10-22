import {ok,HttpError} from '../../utils/http.js';
export const recetasController=(s,documents)=>({
  children:async(_q,r)=>ok(r,await s.children()),list:async(q,r)=>ok(r,await s.list(q.params.id)),create:async(q,r)=>ok(r,await s.create(q.body,q.session.user.id_usuario),201),dispenser:async(q,r)=>ok(r,await s.dispenser(q.params.id,q.body,q.session.user.id_usuario)),allergy:async(q,r)=>ok(r,await s.allergy(q.body,q.session.user.id_usuario),201),
  uploadDocument:async(q,r)=>{if(!Buffer.isBuffer(q.body))throw new HttpError(415,'UNSUPPORTED_MEDIA','Envía PDF, PNG o JPEG binario');ok(r,await documents.upload(q.params.id,'OTRO',q.body,q.get('Content-Type')?.split(';')[0],q.session.user.id_usuario,'MEDICO'),201);},
  downloadDocument:async(q,r)=>{if(!/^[1-9]\d{0,14}$/.test(q.params.documentId))throw new HttpError(400,'INVALID_ID','Identificador inválido');const f=await documents.download(q.params.id,q.params.documentId,q.session.user.id_usuario,'MEDICO');const ext={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg'}[f.mime];r.set('Content-Type',f.mime).set('Content-Disposition',`attachment; filename="documento-medico-${q.params.documentId}.${ext}"`).send(f.buffer);},
});
