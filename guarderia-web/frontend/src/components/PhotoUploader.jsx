import React,{useState} from 'react';
import {api} from '../api/client.js';

export default function PhotoUploader({endpoint,label='Fotografía',available=false,onSaved}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(event){event.preventDefault();const file=event.currentTarget.elements.archivo.files[0];if(!file){setError('Selecciona una fotografía');return;}setBusy(true);setError('');try{await api(endpoint,{method:'POST',headers:{'Content-Type':file.type},body:file});event.currentTarget.reset();onSaved?.();}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <section className="photo-uploader"><h4>{label}</h4>{available&&<img className="person-photo" src={`${endpoint}`} alt={label}/>}<form onSubmit={submit}><input name="archivo" type="file" accept="image/png,image/jpeg" required/><button disabled={busy}>{busy?'Guardando…':available?'Actualizar fotografía':'Guardar fotografía'}</button></form>{error&&<p role="alert">{error}</p>}</section>;
}
