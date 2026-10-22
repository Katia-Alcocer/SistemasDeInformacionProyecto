import React,{useRef,useState} from 'react';
import {api} from '../../api/client.js';
export default function StockOperations({items,classroom=false,admin=false,onSaved}){
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[type,setType]=useState(classroom?'CONSUMO':'ENTRADA');
  const key=useRef(crypto.randomUUID());
  async function save(event){
    event.preventDefault();const form=event.currentTarget,d=new FormData(form);setBusy(true);setError('');setNotice('');
    try{const r=await api(classroom?'/aulas/insumos/descontar':'/insumos/movimientos',{method:classroom?'PUT':'POST',headers:{'Idempotency-Key':key.current},body:JSON.stringify({id_insumo_menor:Number(d.get('insumo')),tipo:type,cantidad:Number(d.get('cantidad')),motivo:d.get('motivo')})});
      key.current=crypto.randomUUID();form.reset();setType(classroom?'CONSUMO':'ENTRADA');setNotice(`Movimiento guardado. Saldo: ${r.saldo_resultante}`);await onSaved();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <form onSubmit={save} onChange={()=>{key.current=crypto.randomUUID();}}><h3>{classroom?'Registrar consumo':'Registrar movimiento'}</h3>
    {!classroom&&<label>Tipo de movimiento<select value={type} onChange={e=>setType(e.target.value)}><option value="ENTRADA">Reposición</option>{admin&&<><option value="CONSUMO">Consumo</option><option value="AJUSTE">Ajuste por diferencia</option></>}</select></label>}
    <label>Insumo del movimiento<select name="insumo" required disabled={busy}><option value="">Seleccionar</option>{items.map(i=><option key={i.id_insumo_menor} value={i.id_insumo_menor}>{i.nombre} ({i.unidad})</option>)}</select></label>
    <label>{type==='AJUSTE'?'Diferencia a sumar o restar':'Cantidad del movimiento'}<input name="cantidad" type="number" min={type==='AJUSTE'?'-999999999.999':'0.001'} max="999999999.999" step="0.001" required disabled={busy}/></label>
    {type==='AJUSTE'&&<p>Captura la diferencia con signo: −2 resta dos unidades, 2 suma dos. No es el saldo final.</p>}
    <label>Motivo del movimiento<input name="motivo" required minLength={3} maxLength={255} disabled={busy}/></label><p role="alert">{error}</p><p role="status">{notice}</p><button disabled={busy||!items.length}>Guardar movimiento</button>
  </form>;
}
export function SupplyNotices({items,notices=[],classroom=false,onSaved}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function confirm(event,item){event.preventDefault();const d=new FormData(event.currentTarget);setBusy(true);setError('');try{await api(classroom?'/aulas/insumos/avisos':'/insumos/avisos',{method:'POST',body:JSON.stringify({id_insumo_menor:item.id_insumo_menor,dias_estimados:item.nivel_aviso,confirmacion_contacto:d.get('confirmado')==='on',observaciones:d.get('observaciones')})});await onSaved();}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <><h3>Avisos de reposición</h3><p>Estimación de días completos según el consumo individual. El contacto con el tutor se realiza por los canales de la guardería y se confirma aquí.</p><p role="alert">{error}</p>
    {items.map(i=><div key={i.id_insumo_menor}><p><strong>{i.nombre}:</strong> {i.dias_estimados===null?'Sin estimación configurada':`${i.dias_estimados} días disponibles`}{i.nivel_aviso!==null&&i.nivel_aviso!==undefined?' · Requiere reposición':''}</p>
      {i.nivel_aviso!==null&&i.nivel_aviso!==undefined&&<form onSubmit={e=>confirm(e,i)}><label>Detalle del contacto para {i.nombre}<input name="observaciones" required minLength={3} maxLength={255}/></label><label className="check"><input type="checkbox" name="confirmado" required/>Ya contacté al tutor por este aviso de {i.nombre}</label><button disabled={busy}>Guardar contacto por {i.nombre}</button></form>}
    </div>)}
    {notices.length>0&&<details><summary>Contactos registrados ({notices.length})</summary><ul>{notices.map(a=><li key={a.id_aviso}>{a.fecha}: {a.dias_estimados} días, {a.observaciones} (usuario {a.notificado_por})</li>)}</ul></details>}
  </>;
}
