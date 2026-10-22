import React from 'react';
import {test,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import App from '../App.jsx';
const response=(status,data,message='Error')=>({status,ok:status<400,json:async()=>({data,message,error:null})});
function setup(writer,role='ENFERMERIA'){
 let measured=false;const mock=vi.fn(async(path,options)=>{
  if(path.endsWith('/auth/me'))return response(200,{user:{nombre:'Operador',rol:role},csrfToken:'csrf'});
  if(options?.method==='POST'||options?.method==='PATCH'){const r=await writer(path,options);if(r.ok&&path.endsWith('/mediciones'))measured=true;return r;}
  if(path.endsWith('/enfermeria/menores'))return response(200,[{id_menor:7,codigo:'FICTICIO',nombres:'Menor',apellido_paterno:'Prueba'}]);
  if(path.endsWith('/enfermeria/recolecciones'))return response(200,{alertas:role==='RECEPCION'?[{id_alerta:77,id_asistencia:80,nombres:'Menor',apellido_paterno:'Prueba',estado:'PENDIENTE',creada_at:'2026-10-21 16:00:00'}]:[]});
  if(path.includes('/enfermeria/cobertura'))return response(200,{mes:'2026-10',poblacion:'ACTIVOS_ACTUALES',total:1,medidos:measured?1:0,pendientes:measured?0:1,menores:[{id_menor:7,codigo:'FICTICIO',nombres:'Menor',apellido_paterno:'Prueba',id_medicion:measured?12:null,peso_kg:'10.125',talla_cm:'75.25'}]});
  return response(200,{menor:{id_menor:7,nombres:'Menor',apellido_paterno:'Prueba',estatus:'ACTIVO'},fecha_operativa:'2026-10-21',asistencia:{id_asistencia:80},atenciones:[{id_atencion:11,atendido_at:'2026-10-21 16:00:00',motivo:'Incidente ficticio',acciones:'Acciones ficticias',id_usuario:2}],mediciones:[]});
 });vi.stubGlobal('fetch',mock);render(<MemoryRouter initialEntries={['/enfermeria']}><App/></MemoryRouter>);return mock;
}
async function select(){await screen.findByRole('option',{name:'FICTICIO · Menor Prueba'});await userEvent.selectOptions(screen.getByLabelText('Menor para enfermería'),'7');await screen.findByLabelText('Motivo o incidente');}
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
test('atención exige confirmación, conserva clave en fallo de red y solicita urgencia con asistencia',async()=>{
 let n=0;const mock=setup(async()=>{if(++n===1)throw new Error('Red interrumpida');return response(201,{id_atencion:11,id_alerta:77});});await select();expect(screen.getByLabelText('Confirmo que documenté la atención realizada').required).toBe(true);await userEvent.type(screen.getByLabelText('Motivo o incidente'),'Incidente documentado');await userEvent.type(screen.getByLabelText('Acciones realizadas'),'Acciones realmente realizadas');await userEvent.click(screen.getByLabelText('Solicitar recolección urgente'));await userEvent.click(screen.getByLabelText('Confirmo que documenté la atención realizada'));await userEvent.click(screen.getByRole('button',{name:'Guardar atención'}));await screen.findByText('Red interrumpida');await userEvent.click(screen.getByRole('button',{name:'Guardar atención'}));await screen.findByText('Registro guardado');
 const posts=mock.mock.calls.filter(([,o])=>o?.method==='POST');expect(posts).toHaveLength(2);expect(posts[0][1].headers['Idempotency-Key']).toBe(posts[1][1].headers['Idempotency-Key']);expect(JSON.parse(posts[1][1].body)).toMatchObject({id_menor:7,id_asistencia:80,requiere_recoleccion:true,confirmacion:true});expect(screen.getByRole('button',{name:'Guardar atención'}).disabled).toBe(true);
});
test('mensual usa kg/cm sin fecha de cliente y actualiza cobertura después de guardar',async()=>{
 const mock=setup(async()=>response(201,{id_medicion:12}));await select();await screen.findByText('Pendiente de medición mensual');await userEvent.type(screen.getByLabelText('Peso medido en kg'),'10.125');await userEvent.type(screen.getByLabelText('Talla medida en cm'),'75.25');await userEvent.click(screen.getByLabelText('Cotejé el menor, la medición real y sus unidades'));await userEvent.click(screen.getByRole('button',{name:'Guardar medición'}));await screen.findByText('2026-10: 1 de 1 medidos · Pendientes: 0');const post=mock.mock.calls.find(([,o])=>o?.method==='POST');expect(JSON.parse(post[1].body)).toEqual({id_menor:7,id_atencion:null,tipo:'MENSUAL',peso_kg:10.125,talla_cm:75.25,confirmacion_medicion:true});
});
test('recepción confirma contacto sin solicitar expediente clínico ni mostrar cancelación',async()=>{
 const mock=setup(async()=>response(200,{}),'RECEPCION');await screen.findByLabelText('Detalle del contacto 77');expect(screen.queryByLabelText('Menor para enfermería')).toBeNull();expect(screen.queryByRole('heading',{name:'Cobertura mensual'})).toBeNull();expect(screen.queryByText('Cancelar solicitud 77')).toBeNull();await userEvent.type(screen.getByLabelText('Detalle del contacto 77'),'Llamada realizada al responsable');await userEvent.click(screen.getByLabelText('Confirmo que contacté al responsable por esta solicitud'));await userEvent.click(screen.getByRole('button',{name:'Guardar contacto 77'}));await screen.findByText('Registro guardado');expect(mock.mock.calls.some(([p])=>p.includes('/enfermeria/menores'))).toBe(false);const patch=mock.mock.calls.find(([,o])=>o?.method==='PATCH');expect(patch[0]).toBe('/api/v1/enfermeria/recolecciones/77/contacto');
});
