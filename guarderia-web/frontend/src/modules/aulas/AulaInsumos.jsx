import React,{useEffect,useState} from 'react';
import {api} from '../../api/client.js';
import StockOperations,{SupplyNotices} from '../insumos/StockOperations.jsx';
export default function AulaInsumos(){
  const [groups,setGroups]=useState([]),[selected,setSelected]=useState(''),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{api('/aulas/grupos').then(setGroups).catch(e=>setError(e.message));},[]);
  async function load(id=selected){if(!id){setData(null);return;}setBusy(true);setError('');try{setData(await api(`/aulas/grupos/${id}/insumos`));}catch(e){setData(null);setError(e.message);}finally{setBusy(false);}}
  useEffect(()=>{setData(null);load();},[selected]);
  return <><section><h1>Inventario de aula</h1><p>Se muestran los menores con ingreso registrado hoy, aún sin entrega, en tus grupos vigentes.</p><label>Grupo del aula<select value={selected} onChange={e=>setSelected(e.target.value)} disabled={busy}><option value="">Seleccionar</option>{groups.map(g=><option key={g.id_grupo} value={g.id_grupo}>{g.codigo} · {g.nombre}</option>)}</select></label><p role="alert">{error}</p>{selected&&<button onClick={()=>load()} disabled={busy}>Actualizar saldos</button>}{busy&&<p role="status">Consultando aula…</p>}</section>
    {data&&<><p>Fecha operativa: {data.fecha_operativa}</p>{!data.menores.length&&<section><p>No hay menores presentes en este grupo.</p></section>}{data.menores.map(c=><section key={c.id_menor}><h2>{c.nombres} {c.apellido_paterno}</h2><p>{c.codigo}</p><div className="table-wrap"><table><thead><tr><th>Insumo</th><th>Saldo individual</th></tr></thead><tbody>{c.insumos.map(i=><tr key={i.id_insumo_menor}><td>{i.nombre}</td><td>{i.cantidad_actual} {i.unidad}</td></tr>)}</tbody></table></div><StockOperations key={`${selected}-${c.id_menor}`} items={c.insumos} classroom onSaved={load}/><SupplyNotices items={c.insumos} notices={c.avisos} classroom onSaved={load}/></section>)}</>}
  </>;
}
