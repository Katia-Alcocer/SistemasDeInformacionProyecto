import React from 'react';
import {test,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import App from '../App.jsx';
const response=(status,data,message='Error')=>({status,ok:status<400,json:async()=>({data,message,error:status>=400?{code:'REJECTED'}:null})});
const summary={fecha:'2026-10-21',ingreso_at:'2026-10-21 14:15:00',actividades:[],alimentacion:[],medicamentos:[],enfermeria:[]};
const attendance={id_asistencia:80,id_menor:7,codigo:'FICTICIO',nombres:'Menor ficticio',apellido_paterno:'Prueba'};
function setup(writer,extra={}){let delivered=false;const mock=vi.fn(async(path,options)=>{
  if(path.endsWith('/auth/me'))return response(200,{user:{nombre:'Recepción',rol:'RECEPCION'},csrfToken:'csrf'});
  if(options?.method==='POST'){const result=await writer(options);if(result.ok)delivered=true;return result;}
  if(path.endsWith('/recepcion/salidas'))return response(200,{fecha_operativa:'2026-10-21',ventana:{inicio:'15:00:00',fin_exclusivo:'16:00:00'},asistencias:[attendance]});
  return response(200,{fecha_operativa:'2026-10-21',hora_servidor:'15:30:00',asistencia:attendance,autorizados:[{id_vinculo:4,nombre:'Persona ficticia',tipo:'PRINCIPAL',parentesco:'Familiar'}],resumen:summary,entrega:delivered?{id_entrega:22,identidad_receptor:{nombre:'Persona ficticia'},resumen_diario:summary,entregado_at:'2026-10-21 21:30:00',id_usuario:2}:null,...extra});
});vi.stubGlobal('fetch',mock);render(<MemoryRouter initialEntries={['/salidas']}><App/></MemoryRouter>);return mock;}
async function select(){await screen.findByRole('option',{name:'FICTICIO · Menor ficticio Prueba'});await userEvent.selectOptions(screen.getByLabelText('Asistencia para entrega'),'80');await screen.findByLabelText('Persona autorizada que recoge');}
async function fill(){await userEvent.selectOptions(screen.getByLabelText('Persona autorizada que recoge'),'4');await userEvent.click(screen.getByLabelText('Cotejé la identidad con la persona autorizada seleccionada'));await userEvent.click(screen.getByLabelText('Confirmo la entrega del menor a esa persona'));await userEvent.type(screen.getByLabelText('Observaciones de entrega'),'Identidad y autorización cotejadas');}
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
test('salida exige vínculo, identidad y entrega; muestra resumen sin inventar hora cliente',async()=>{
  const mock=setup(async()=>response(201,{id_entrega:22,tardia:false}));await select();expect(screen.getByLabelText('Persona autorizada que recoge').required).toBe(true);expect(screen.getByLabelText('Cotejé la identidad con la persona autorizada seleccionada').checked).toBe(false);expect(screen.getByLabelText('Confirmo la entrega del menor a esa persona').required).toBe(true);
  await fill();await userEvent.click(screen.getByRole('button',{name:'Validar y registrar entrega'}));await screen.findByRole('heading',{name:'Entrega confirmada'});const post=mock.mock.calls.find(([,o])=>o?.method==='POST');expect(JSON.parse(post[1].body)).toMatchObject({id_asistencia:80,id_vinculo:4,identidad_verificada:true,confirmacion:true,codigo_gafete:null});expect(JSON.parse(post[1].body).hora_salida).toBeUndefined();
});
test('rechazo conserva formulario y no presenta entrega confirmada',async()=>{
  setup(async()=>response(422,{rechazada:true},'La persona tiene restricción judicial vigente'));await select();await fill();await userEvent.click(screen.getByRole('button',{name:'Validar y registrar entrega'}));await screen.findByText('La persona tiene restricción judicial vigente');expect(screen.queryByRole('heading',{name:'Entrega confirmada'})).toBeNull();expect(screen.getByLabelText('Persona autorizada que recoge').value).toBe('4');
});
test('fallo de red conserva clave para reintento y muestra retardo pendiente',async()=>{
  let n=0;const mock=setup(async()=>{if(++n===1)throw new Error('Red interrumpida');return response(201,{id_entrega:22,tardia:true});});await select();await fill();await userEvent.click(screen.getByRole('button',{name:'Validar y registrar entrega'}));await screen.findByText('Red interrumpida');await userEvent.click(screen.getByRole('button',{name:'Validar y registrar entrega'}));await screen.findByText('Entrega registrada: 22 · Retardo pendiente de revisión');const posts=mock.mock.calls.filter(([,o])=>o?.method==='POST');expect(posts).toHaveLength(2);expect(posts[0][1].headers['Idempotency-Key']).toBe(posts[1][1].headers['Idempotency-Key']);
});
test('selección urgente se envía además del vínculo y cotejos de identidad',async()=>{
 const mock=setup(async()=>response(201,{id_entrega:22,tardia:false}),{recolecciones:[{id_alerta:77,estado:'PENDIENTE'}]});await select();await fill();await userEvent.selectOptions(screen.getByLabelText('Solicitud urgente de enfermería (opcional)'),'77');await userEvent.click(screen.getByRole('button',{name:'Validar y registrar entrega'}));await screen.findByRole('heading',{name:'Entrega confirmada'});expect(JSON.parse(mock.mock.calls.find(([,o])=>o?.method==='POST')[1].body)).toMatchObject({id_alerta_recoleccion:77,id_vinculo:4,identidad_verificada:true,confirmacion:true});
});
