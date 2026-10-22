import React from 'react';
import {test,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import App from '../App.jsx';
const response=(status,data,message='Error')=>({status,ok:status<400,json:async()=>({data,message,error:null})});
const child={id_menor:7,id_asistencia:80,nombres:'Menor ficticio',apellido_paterno:'Prueba',grupo:'Aula ficticia',habilitado_comedor:true,restricciones:[],traslados:[{id_traslado:9,salida_at:null}],registros:[]};
function setup(writer,extra={},role='EDUCADORA'){const mock=vi.fn(async(path,options)=>{
  if(path.endsWith('/auth/me'))return response(200,{user:{nombre:'Operador',rol:role},csrfToken:'csrf'});
  if(options?.method==='POST'||options?.method==='PATCH')return writer(path,options);
  if(path.endsWith('/comedor/catalogos'))return response(200,{ingredientes:[{id_ingrediente:1,nombre:'ARROZ'}],platillos:[{id_platillo:5,nombre:'Arroz revisado',ingredientes:[1]}]});
  return response(200,{fecha_operativa:'2026-10-21',menores:[{...child,...extra}]});
});vi.stubGlobal('fetch',mock);render(<MemoryRouter initialEntries={['/comedor']}><App/></MemoryRouter>);return mock;}
async function fillMeal(){await screen.findByLabelText('Platillo servido');await userEvent.selectOptions(screen.getByLabelText('Platillo servido'),'5');await userEvent.type(screen.getByLabelText('Observaciones de alimentación'),'Consumo real cotejado');await userEvent.click(screen.getByLabelText('Cotejé el consumo real y, si hubo alimento, la composición y restricciones vigentes'));}
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
test('ración rechazada por incompatibilidad conserva formulario y no anuncia éxito',async()=>{
  setup(async()=>response(422,null,'El platillo contiene un ingrediente prohibido'));await fillMeal();await userEvent.click(screen.getByRole('button',{name:'Guardar ración'}));await screen.findByText('El platillo contiene un ingrediente prohibido');expect(screen.queryByText('Registro guardado')).toBeNull();expect(screen.getByLabelText('Platillo servido').value).toBe('5');
});
test('reintento de red mantiene clave de ración y el contenido enviado',async()=>{
  let n=0;const mock=setup(async()=>{if(++n===1)throw new Error('Red interrumpida');return response(201,{id_registro:10});});await fillMeal();await userEvent.click(screen.getByRole('button',{name:'Guardar ración'}));await screen.findByText('Red interrumpida');await userEvent.click(screen.getByRole('button',{name:'Guardar ración'}));await screen.findByText('Registro guardado');const posts=mock.mock.calls.filter(([,o])=>o?.method==='POST');expect(posts).toHaveLength(2);expect(posts[0][1].headers['Idempotency-Key']).toBe(posts[1][1].headers['Idempotency-Key']);expect(JSON.parse(posts[1][1].body)).toMatchObject({id_asistencia:80,id_platillo:5,racion:'COMPLETA',confirmacion_revision:true});
});
test('NADA no asocia platillo y requiere documentar motivo y cotejo',async()=>{
  const mock=setup(async()=>response(201,{}));await screen.findByLabelText('Ración consumida');await userEvent.selectOptions(screen.getByLabelText('Ración consumida'),'NADA');expect(screen.queryByLabelText('Platillo servido')).toBeNull();expect(screen.getByLabelText('Observaciones de alimentación').required).toBe(true);await userEvent.type(screen.getByLabelText('Observaciones de alimentación'),'No consumió por restricción');await userEvent.click(screen.getByLabelText('Cotejé el consumo real y, si hubo alimento, la composición y restricciones vigentes'));await userEvent.click(screen.getByRole('button',{name:'Guardar ración'}));await screen.findByText('Registro guardado');expect(JSON.parse(mock.mock.calls.find(([,o])=>o?.method==='POST')[1].body)).toMatchObject({racion:'NADA',id_platillo:null});
});
test('límite de edad oculta operaciones; enfermería muestra catálogo sin traslado',async()=>{
  setup(async()=>response(200,{}),{habilitado_comedor:false},'ENFERMERIA');await screen.findByText(/Traslado bloqueado por edad/);expect(screen.queryByRole('button',{name:'Registrar entrada a comedor'})).toBeNull();expect(screen.queryByRole('button',{name:'Registrar salida de comedor'})).toBeNull();expect(screen.getByLabelText('Revisé la composición completa del platillo').required).toBe(true);
});
test('enfermería retira revisión con motivo y confirmación de restablecer bloqueo',async()=>{
  const mock=setup(async()=>response(200,{}),{restricciones:[{id_restriccion:77,tipo:'ALERGIA_BASE',descripcion:'Restricción ficticia',revision_comedor:{ingredientes_prohibidos:[1]}}]},'ENFERMERIA');await screen.findByText('Revisar restricción 77');await userEvent.click(screen.getByText('Revisar restricción 77'));await userEvent.type(screen.getByLabelText('Motivo para retirar revisión 77'),'Se requiere nuevo cotejo');await userEvent.click(screen.getByLabelText('Confirmo retirar revisión 77 y restablecer el bloqueo'));await userEvent.click(screen.getByRole('button',{name:'Retirar revisión 77'}));await screen.findByText('Registro guardado');const patch=mock.mock.calls.find(([,o])=>o?.method==='PATCH');expect(JSON.parse(patch[1].body)).toEqual({confirmacion:true,motivo:'Se requiere nuevo cotejo'});
});
