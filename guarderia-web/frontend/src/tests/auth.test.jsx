import React from 'react';
import {test,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import App from '../App.jsx';
const response=(status,data,message='Error')=>({status,ok:status<400,json:async()=>({data,message})});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
test('sin sesión redirige a login y muestra error de credenciales',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response(401,null)).mockResolvedValueOnce(response(401,null,'Correo o contraseña incorrectos')));
  render(<MemoryRouter initialEntries={['/usuarios']}><App/></MemoryRouter>);
  await screen.findByRole('heading',{name:'Iniciar sesión'});
  await userEvent.type(screen.getByLabelText('Correo electrónico'),'usuario@example.test');
  await userEvent.type(screen.getByLabelText('Contraseña'),'incorrecta');
  await userEvent.click(screen.getByRole('button',{name:'Entrar'}));
  expect(await screen.findByText('Correo o contraseña incorrectos')).toBeTruthy();
});
test('RECEPCION no ve enlaces administrativos y puede cerrar sesión',async()=>{
  const fetchMock=vi.fn().mockResolvedValueOnce(response(200,{user:{nombre:'Recepción ficticia',rol:'RECEPCION'},csrfToken:'csrf-test'})).mockResolvedValueOnce(response(204,null));vi.stubGlobal('fetch',fetchMock);
  render(<MemoryRouter><App/></MemoryRouter>);
  await screen.findByRole('heading',{name:'Bienvenido, Recepción ficticia'});
  expect(screen.queryByRole('link',{name:'Personal'})).toBeNull();
  await userEvent.click(screen.getByRole('button',{name:'Cerrar sesión'}));
  await screen.findByRole('heading',{name:'Iniciar sesión'});
  await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls[1][1].headers['X-CSRF-Token']).toBe('csrf-test');
});
test('rol ajeno no puede abrir directamente la gestión de grupos',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response(200,{user:{nombre:'Educadora ficticia',rol:'EDUCADORA'},csrfToken:'csrf'})));
  render(<MemoryRouter initialEntries={['/grupos']}><App/></MemoryRouter>);
  expect(await screen.findByText('No tienes permiso para esta sección.')).toBeTruthy();
});
test('sesión revocada durante una consulta vuelve al login',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response(200,{user:{nombre:'Admin',rol:'ADMIN'},csrfToken:'csrf'})).mockResolvedValueOnce(response(401,null,'La sesión expiró o fue revocada')));
  render(<MemoryRouter initialEntries={['/usuarios']}><App/></MemoryRouter>);
  expect(await screen.findByRole('heading',{name:'Iniciar sesión'})).toBeTruthy();
});
test('ADMIN puede enviar un alta de usuario y ver confirmación',async()=>{
  const fetchMock=vi.fn().mockResolvedValueOnce(response(200,{user:{nombre:'Admin ficticio',rol:'ADMIN'},csrfToken:'csrf'})).mockResolvedValueOnce(response(200,[])).mockResolvedValueOnce(response(201,{id_usuario:1})).mockResolvedValueOnce(response(200,[{id_usuario:1,nombre:'Persona ficticia',email:'ficticio@example.test',rol:'RECEPCION',activo:true}]));
  vi.stubGlobal('fetch',fetchMock);
  render(<MemoryRouter initialEntries={['/usuarios']}><App/></MemoryRouter>);
  await screen.findByRole('heading',{name:'Crear usuario'});
  await userEvent.type(screen.getByLabelText('Nombre'),'Persona ficticia');
  await userEvent.type(screen.getByLabelText('Correo'),'ficticio@example.test');
  await userEvent.type(screen.getByLabelText('Contraseña'),'Password-ficticio-123');
  await userEvent.click(screen.getByRole('button',{name:'Guardar'}));
  expect(await screen.findByText('Persona ficticia')).toBeTruthy();
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).rol).toBe('RECEPCION');
});
test('ADMIN recibe una validación clara al habilitar un grupo sin responsable',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response(200,{user:{nombre:'Admin ficticio',rol:'ADMIN'},csrfToken:'csrf'})).mockResolvedValueOnce(response(200,[])).mockResolvedValueOnce(response(200,[])).mockResolvedValueOnce(response(200,[{id_categoria:1,codigo:'G0',nombre:'Lactantes'}])).mockResolvedValueOnce(response(422,null,'Asigna una responsable antes de habilitar el grupo')));
  render(<MemoryRouter initialEntries={['/grupos']}><App/></MemoryRouter>);
  await screen.findByRole('heading',{name:'Crear grupo'});
  await userEvent.type(screen.getByLabelText('Nombre'),'Grupo ficticio');
  await userEvent.type(screen.getByLabelText('Código'),'GF');
  await userEvent.selectOptions(screen.getByLabelText('Categoría'),'1');
  await userEvent.click(screen.getByLabelText('Activo'));
  await userEvent.click(screen.getByRole('button',{name:'Guardar'}));
  expect(await screen.findByText('Asigna una responsable antes de habilitar el grupo')).toBeTruthy();
});
