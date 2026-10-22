import React from 'react';
import {test,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import App from '../App.jsx';
import Documents from '../modules/menores/Documents.jsx';
const response=(status,data,message='Error')=>({status,ok:status<400,json:async()=>({data,message})});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
test('wizard crea expediente pendiente sin simular activación',async()=>{
  let created=false;
  const child={id_menor:7,codigo:'FICTICIO',nombres:'Menor ficticio',apellido_paterno:'Prueba',fecha_nacimiento:'2026-01-01',estatus:'PENDIENTE',documentos:[],historial_grupos:[]};
  const fetchMock=vi.fn(async(path,options)=>{
    if(path.endsWith('/auth/me'))return response(200,{user:{nombre:'Admin',rol:'ADMIN'},csrfToken:'token'});
    if(path.endsWith('/preinscripciones'))return response(200,[]);
    if(options?.method==='POST'){created=true;return response(201,child);}
    if(path.endsWith('/7'))return response(200,child);
    return response(200,created?[child]:[]);
  });vi.stubGlobal('fetch',fetchMock);
  render(<MemoryRouter initialEntries={['/expedientes']}><App/></MemoryRouter>);
  await userEvent.click(await screen.findByRole('button',{name:'Nuevo expediente'}));
  expect(screen.getByRole('button',{name:'2. Documentos'}).disabled).toBe(true);
  await userEvent.type(screen.getByLabelText('Código'),'FICTICIO');
  await userEvent.type(screen.getByLabelText('Nombres'),'Menor ficticio');
  await userEvent.type(screen.getByLabelText('Apellido paterno'),'Prueba');
  fireEvent.change(screen.getByLabelText('Fecha de nacimiento'),{target:{value:'2026-01-01'}});
  await userEvent.click(screen.getByRole('button',{name:'Guardar datos'}));
  await screen.findByRole('heading',{name:'Datos del expediente'});
  expect(screen.getByRole('button',{name:'2. Documentos'}).disabled).toBe(false);
  const call=fetchMock.mock.calls.find(([,options])=>options?.method==='POST');
  expect(JSON.parse(call[1].body).estatus).toBeUndefined();
});
test('preinscripción muestra rechazo del intervalo sin confirmar registro',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(path,options)=>path.endsWith('/auth/me')?response(200,{user:{nombre:'Admin',rol:'ADMIN'},csrfToken:'token'}):options?.method==='POST'?response(422,null,'Fecha fuera de ventana de cuatro meses'):response(200,[])));
  render(<MemoryRouter initialEntries={['/preinscripciones']}><App/></MemoryRouter>);
  await screen.findByRole('heading',{name:'Nueva solicitud'});
  await userEvent.type(screen.getByLabelText('Nombre del contacto'),'Contacto ficticio');
  await userEvent.type(screen.getByLabelText('Teléfono del contacto'),'5550000000');
  fireEvent.change(screen.getByLabelText('Fecha probable de parto'),{target:{value:'2028-01-01'}});
  await userEvent.click(screen.getByRole('button',{name:'Guardar solicitud'}));
  expect(await screen.findByText('Fecha fuera de ventana de cuatro meses')).toBeTruthy();
});
test('subida envía archivo binario y su tipo, no ruta privada ni JSON',async()=>{
  const fetchMock=vi.fn().mockResolvedValue(response(201,{id_documento:1}));vi.stubGlobal('fetch',fetchMock);
  const refresh=vi.fn().mockResolvedValue();
  render(<Documents child={{id_menor:7,documentos:[]}} refresh={refresh}/>);
  const file=new File(['%PDF-1.4\n%%EOF'],'acta.pdf',{type:'application/pdf'});
  await userEvent.upload(screen.getByLabelText('Archivo'),file);
  expect(screen.getByLabelText('Archivo').files).toHaveLength(1);
  // jsdom no sincroniza required con el FileList simulado de user-event.
  // Se verifica el archivo seleccionado y se dispara el submit del formulario.
  fireEvent.submit(screen.getByRole('button',{name:'Subir documento'}).closest('form'));
  await screen.findByText('Documento guardado. Revisa su contenido antes de validarlo.');
  expect(fetchMock.mock.calls[0][1].body).toBe(file);expect(fetchMock.mock.calls[0][1].headers['X-Document-Type']).toBe('ACTA_NACIMIENTO');
});
