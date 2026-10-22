import React from 'react';
import {test,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import App from '../App.jsx';
const response=(status,data,message='Error')=>({status,ok:status<400,json:async()=>({data,message,error:null})});
const today='2026-10-21',present={id_asistencia:80,id_menor:7,nombres:'Menor ficticio',apellido_paterno:'Prueba'};
function setup(write){const mock=vi.fn(async(path,options)=>{
  if(path.endsWith('/auth/me'))return response(200,{user:{nombre:'Educadora',rol:'EDUCADORA'},csrfToken:'csrf'});
  if(path.endsWith('/aulas/grupos'))return response(200,[{id_grupo:4,codigo:'A4',nombre:'Aula ficticia'}]);
  if(options?.method==='POST')return write(options);
  return response(200,{fecha_operativa:today,fecha_consulta:today,menores:[present],actividades:[]});
});vi.stubGlobal('fetch',mock);render(<MemoryRouter initialEntries={['/aula/actividades']}><App/></MemoryRouter>);return mock;}
async function select(){await screen.findByRole('option',{name:'A4 · Aula ficticia'});await userEvent.selectOptions(screen.getByLabelText('Grupo para actividades'),'4');await screen.findByLabelText('Título de la actividad');}
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
test('actividad exige participantes y conserva clave/payload en reintento de red',async()=>{
  let n=0;const mock=setup(async()=>{if(++n===1)throw new Error('Conexión interrumpida');return response(201,{id_actividad:22});});await select();
  expect(screen.getByRole('button',{name:'Registrar actividad'}).disabled).toBe(true);await userEvent.type(screen.getByLabelText('Título de la actividad'),'Lectura colectiva');await userEvent.click(screen.getByLabelText('Menor ficticio Prueba'));await userEvent.type(screen.getByLabelText('Observaciones de Menor ficticio'),'Participación activa');
  await userEvent.click(screen.getByRole('button',{name:'Registrar actividad'}));await screen.findByText('Conexión interrumpida');await userEvent.click(screen.getByRole('button',{name:'Registrar actividad'}));await screen.findByText('Actividad registrada: 22');
  const posts=mock.mock.calls.filter(([,o])=>o?.method==='POST');expect(posts).toHaveLength(2);expect(posts[0][1].headers['Idempotency-Key']).toBe(posts[1][1].headers['Idempotency-Key']);expect(JSON.parse(posts[1][1].body)).toEqual({titulo:'Lectura colectiva',descripcion:null,participantes:[{id_asistencia:80,observaciones:'Participación activa'}]});
});
test('rechazo por presencia conserva registro sin anunciar éxito',async()=>{
  setup(async()=>response(422,null,'El menor ya no está presente'));await select();await userEvent.type(screen.getByLabelText('Título de la actividad'),'Actividad rechazada');await userEvent.click(screen.getByLabelText('Menor ficticio Prueba'));fireEvent.submit(screen.getByRole('button',{name:'Registrar actividad'}).closest('form'));
  await screen.findByText('El menor ya no está presente');expect(screen.getByLabelText('Título de la actividad').value).toBe('Actividad rechazada');expect(screen.queryByText(/Actividad registrada:/)).toBeNull();
});
