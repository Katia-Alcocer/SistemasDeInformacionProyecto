import {randomBytes,randomUUID,createCipheriv,createDecipheriv,createHash} from 'node:crypto';
import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {HttpError} from '../../utils/http.js';
export const hashContent=data=>createHash('sha256').update(data).digest('hex');
export function detectMime(buffer){
  if(!Buffer.isBuffer(buffer)||buffer.length<12)throw new HttpError(422,'INVALID_DOCUMENT','El archivo está vacío o dañado');
  if(buffer.subarray(0,5).toString()==='%PDF-'&&buffer.subarray(-1024).toString().includes('%%EOF')){
    if(/\/(JavaScript|JS|Launch|EmbeddedFile)\b/.test(buffer.toString('latin1')))throw new HttpError(422,'ACTIVE_DOCUMENT','No se permiten documentos con contenido activo o adjuntos');
    return 'application/pdf';
  }
  if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&buffer.subarray(-8,-4).toString()==='IEND')return 'image/png';
  if(buffer[0]===255&&buffer[1]===216&&buffer[2]===255&&buffer.at(-2)===255&&buffer.at(-1)===217)return 'image/jpeg';
  throw new HttpError(422,'INVALID_DOCUMENT','Solo se aceptan PDF, PNG o JPEG con firma y cierre válidos');
}
export function privateStorage(config){
  const directory=resolve(config.uploadDir||process.env.UPLOAD_PRIVATE_DIR||'/app/private_uploads');
  function key(){const value=config.documentKey||process.env.DOCUMENT_ENCRYPTION_KEY;if(!/^[a-fA-F0-9]{64}$/.test(value||''))throw new HttpError(503,'STORAGE_UNAVAILABLE','Falta configurar la clave privada de documentos');return Buffer.from(value,'hex');}
  function path(name){if(!/^[a-f0-9-]{36}\.enc$/.test(name))throw new HttpError(500,'DOCUMENT_INTEGRITY','Referencia privada inválida');return join(directory,name);}
  return {
    async write(buffer,declared){
      if(!buffer?.length||buffer.length>2*1024*1024)throw new HttpError(413,'DOCUMENT_SIZE','El archivo debe pesar entre 1 byte y 2 MB');
      const mime=detectMime(buffer);if(declared!==mime)throw new HttpError(422,'MIME_MISMATCH','El contenido no coincide con el tipo de archivo declarado');
      const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key(),iv);const encrypted=Buffer.concat([cipher.update(buffer),cipher.final()]);
      const name=`${randomUUID()}.enc`;await mkdir(directory,{recursive:true,mode:0o700});await writeFile(path(name),Buffer.concat([iv,cipher.getAuthTag(),encrypted]),{flag:'wx',mode:0o600});
      return {name,mime,hash:hashContent(buffer),size:buffer.length};
    },
    async read(name,expectedHash){
      try{const data=await readFile(path(name));if(data.length<40)throw new Error('truncated');const decipher=createDecipheriv('aes-256-gcm',key(),data.subarray(0,12),{authTagLength:16});decipher.setAuthTag(data.subarray(12,28));const plaintext=Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]);if(expectedHash&&hashContent(plaintext)!==expectedHash)throw new Error('hash');return {buffer:plaintext,mime:detectMime(plaintext)};}
      catch(error){if(error instanceof HttpError&&error.status===503)throw error;throw new HttpError(500,'DOCUMENT_INTEGRITY','No se pudo verificar la integridad del documento');}
    },
    remove:async name=>{await unlink(path(name)).catch(()=>{});},
  };
}
