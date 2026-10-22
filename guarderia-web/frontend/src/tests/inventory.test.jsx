import React from 'react';
import {test,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import App from '../App.jsx';
import StockOperations from '../modules/insumos/StockOperations.jsx';
const response=(status,data,message='Error')=>({status,ok:status<400,json:async()=>({data,message,error:null})});
const item={id_insumo_menor:8,nombre:'Pañales',unidad:'unidad',cantidad_actual:'6.000',dias_estimados:3,nivel_aviso:3};
const data={fecha_operativa:'2026-10-21',grupo:{id_grupo:4},menores:[{id_menor:7,codigo:'FICTICIO',nombres:'Menor ficticio',apellido_paterno:'Prueba',insumos:[item],avisos:[]}]};
function setup(writer){const mock=vi.fn(async(path,options)=>{
  if(path.endsWith('/auth/me'))return response(200,{user:{nombre:'Educadora',rol:'EDUCADORA'},csrfToken:'csrf'});
  if(path.endsWith('/aulas/grupos'))return response(200,[{id_grupo:4,codigo:'A4',nombre:'Aula de prueba'}]);
  if(options?.method==='PUT'||options?.method==='POST')return writer(path,options);
  return response(200,data);
});vi.stubGlobal('fetch',mock);render(<MemoryRouter initialEntries={['/aula/insumos']}><App/></MemoryRouter>);return mock;}
async function select(){await screen.findByRole('option',{name:'A4 · Aula de prueba'});await userEvent.selectOptions(screen.getByLabelText('Grupo del aula'),'4');await screen.findByRole('heading',{name:'Menor ficticio Prueba'});}
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
test('aula muestra días estimados y conserva clave al reintentar un consumo con fallo de red',async()=>{
  let attempts=0;const mock=setup(async()=>{if(++attempts===1)throw new Error('Red interrumpida');return response(201,{saldo_resultante:'5.000'});});await select();
  expect(screen.getByText(/3 días disponibles/)).toBeTruthy();await userEvent.selectOptions(screen.getByLabelText('Insumo del movimiento'),'8');await userEvent.type(screen.getByLabelText('Cantidad del movimiento'),'1');await userEvent.type(screen.getByLabelText('Motivo del movimiento'),'Cambio de pañal');
  await userEvent.click(screen.getByRole('button',{name:'Guardar movimiento'}));await screen.findByText('Red interrumpida');await userEvent.click(screen.getByRole('button',{name:'Guardar movimiento'}));await screen.findByText('Movimiento guardado. Saldo: 5.000');
  const writes=mock.mock.calls.filter(([,o])=>o?.method==='PUT');expect(writes).toHaveLength(2);expect(writes[0][1].headers['Idempotency-Key']).toBe(writes[1][1].headers['Idempotency-Key']);expect(JSON.parse(writes[1][1].body)).toMatchObject({tipo:'CONSUMO',cantidad:1,id_insumo_menor:8});expect(screen.queryByLabelText('Tipo de movimiento')).toBeNull();
});
test('contacto de tutor requiere confirmación y no se registra solo por consultar el aviso',async()=>{
  const mock=setup(async()=>response(201,{id_aviso:9}));await select();expect(mock.mock.calls.some(([,o])=>o?.method==='POST')).toBe(false);
  const check=screen.getByLabelText('Ya contacté al tutor por este aviso de Pañales');expect(check.required).toBe(true);expect(check.checked).toBe(false);
  await userEvent.type(screen.getByLabelText('Detalle del contacto para Pañales'),'Llamada al tutor realizada');await userEvent.click(check);await userEvent.click(screen.getByRole('button',{name:'Guardar contacto por Pañales'}));
  const post=mock.mock.calls.find(([,o])=>o?.method==='POST');expect(JSON.parse(post[1].body)).toMatchObject({id_insumo_menor:8,dias_estimados:3,confirmacion_contacto:true});
});
test('rechazo de saldo insuficiente conserva formulario y no muestra éxito',async()=>{
  setup(async()=>response(422,null,'El movimiento dejaría un saldo negativo'));await select();await userEvent.selectOptions(screen.getByLabelText('Insumo del movimiento'),'8');await userEvent.type(screen.getByLabelText('Cantidad del movimiento'),'9');await userEvent.type(screen.getByLabelText('Motivo del movimiento'),'Consumo excesivo');fireEvent.submit(screen.getByRole('button',{name:'Guardar movimiento'}).closest('form'));
  await screen.findByText('El movimiento dejaría un saldo negativo');expect(screen.getByLabelText('Cantidad del movimiento').value).toBe('9');expect(screen.queryByText(/Movimiento guardado/)).toBeNull();
});
test('ADMIN captura ajuste como diferencia firmada y recupera reposición después de guardar',async()=>{
  const mock=vi.fn(async()=>response(201,{saldo_resultante:'4.000'}));vi.stubGlobal('fetch',mock);render(<StockOperations items={[item]} admin onSaved={async()=>{}}/>);
  await userEvent.selectOptions(screen.getByLabelText('Tipo de movimiento'),'AJUSTE');await userEvent.selectOptions(screen.getByLabelText('Insumo del movimiento'),'8');fireEvent.change(screen.getByLabelText('Diferencia a sumar o restar'),{target:{value:'-2'}});await userEvent.type(screen.getByLabelText('Motivo del movimiento'),'Diferencia de conteo físico');await userEvent.click(screen.getByRole('button',{name:'Guardar movimiento'}));
  await screen.findByText('Movimiento guardado. Saldo: 4.000');expect(JSON.parse(mock.mock.calls[0][1].body)).toMatchObject({tipo:'AJUSTE',cantidad:-2});expect(screen.getByLabelText('Tipo de movimiento').value).toBe('ENTRADA');
});
