import React from 'react';
import {test,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import App from '../App.jsx';
const response=(status,data,message='Error')=>({status,ok:status<400,json:async()=>({data,message,error:status>=400?{code:'INGRESO_RECHAZADO'}:null})});
const ficha=()=>({menor:{id_menor:7,nombres:'Menor ficticio',apellido_paterno:'Prueba',estatus:'ACTIVO'},hora_servidor:'08:15:00',fecha_operativa:'2026-10-21',ventana:{inicio:'08:00:00',fin_exclusivo:'09:00:00'},area_requerida:'CUNERO',autorizados:[],lesiones_previas:[],intentos:[],tratamientos:[],restricciones:[],recetas:[],insumos:[],insumos_revisados:true});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
test('recepción muestra intento rechazado persistido sin simular asistencia',async()=>{
  let committed=false;const data=ficha();const decision={id_intento:55,id_asistencia:null,resultado:'RECHAZADO',fecha_operativa:'2026-10-21',hora_servidor:'08:15:00',motivos:[{codigo:'INSUMO_INSUFICIENTE',mensaje:'Falta mínimo obligatorio de pañales'}]};
  const fetchMock=vi.fn(async(path,options)=>{
    if(path.endsWith('/auth/me'))return response(200,{user:{nombre:'Recepción',rol:'RECEPCION'},csrfToken:'csrf'});
    if(options?.method==='POST'){committed=true;return response(422,decision,'Falta mínimo obligatorio de pañales');}
    return response(200,{...data,intentos:committed?[{id_intento:55,intento_at:'2026-10-21 14:15:00',resultado:'RECHAZADO',motivo_rechazo:'Faltan pañales'}]:[]});
  });vi.stubGlobal('fetch',fetchMock);render(<MemoryRouter initialEntries={['/recepcion']}><App/></MemoryRouter>);
  await userEvent.type(await screen.findByLabelText('Código o ID del menor'),'FICTICIO');await userEvent.click(screen.getByRole('button',{name:'Buscar menor'}));
  await userEvent.click(await screen.findByLabelText('Realicé la inspección en cunero con privacidad y protocolo'));
  await userEvent.click(screen.getByRole('button',{name:'Validar y registrar ingreso'}));
  expect(await screen.findByRole('heading',{name:'Intento rechazado y guardado'})).toBeTruthy();
  expect(screen.queryByRole('heading',{name:'Ingreso aceptado'})).toBeNull();
  const post=fetchMock.mock.calls.find(([,options])=>options?.method==='POST');const body=JSON.parse(post[1].body);expect(body.hora_ingreso).toBeUndefined();expect(body.inspeccion.area).toBe('CUNERO');
});
test('lesión vuelve obligatoria la captura de quien lo lleva',async()=>{
  vi.stubGlobal('fetch',vi.fn(async path=>path.endsWith('/auth/me')?response(200,{user:{nombre:'Recepción',rol:'RECEPCION'},csrfToken:'csrf'}):response(200,ficha())));
  render(<MemoryRouter initialEntries={['/recepcion']}><App/></MemoryRouter>);
  await userEvent.type(await screen.findByLabelText('Código o ID del menor'),'FICTICIO');await userEvent.click(screen.getByRole('button',{name:'Buscar menor'}));
  await userEvent.click(await screen.findByRole('button',{name:'Agregar lesión'}));
  expect(screen.getByLabelText('Nombre de quien lo lleva (obligatorio)').required).toBe(true);expect(screen.getByLabelText('Parentesco de quien lo lleva').required).toBe(true);
});
test('enfermería requiere documento y revisión explícita para guardar receta',async()=>{
  const fetchMock=vi.fn(async(path,options)=>{
    if(path.endsWith('/auth/me'))return response(200,{user:{nombre:'Enfermería',rol:'ENFERMERIA'},csrfToken:'csrf'});
    if(path.endsWith('/recetas/menores'))return response(200,[{id_menor:7,codigo:'FICTICIO',nombres:'Menor',apellido_paterno:'Prueba'}]);
    if(options?.method==='POST')return response(201,{id_documento:99});
    return response(200,{recetas:[],restricciones:[]});
  });vi.stubGlobal('fetch',fetchMock);render(<MemoryRouter initialEntries={['/recetas']}><App/></MemoryRouter>);
  await screen.findByRole('option',{name:'FICTICIO · Menor Prueba'});await userEvent.selectOptions(screen.getByLabelText('Menor para revisión médica'),'7');
  const save=await screen.findByRole('button',{name:'Guardar receta revisada'});expect(save.disabled).toBe(true);
  const file=new File(['%PDF-1.4\n%%EOF'],'receta.pdf',{type:'application/pdf'});await userEvent.upload(screen.getByLabelText('Documento de receta'),file);
  fireEvent.submit(screen.getByRole('button',{name:'Guardar documento médico'}).closest('form'));
  await screen.findByRole('link',{name:'Descargar para revisar'});expect(save.disabled).toBe(false);
  expect(screen.getByLabelText('Confirmo que revisé el documento y transcribí sus datos').required).toBe(true);expect(screen.getByLabelText('Todos los tratamientos y dietas registrados están prescritos en ese documento').checked).toBe(false);
});
test('reintento de reposición conserva clave de idempotencia cuando falla la red',async()=>{
  let entries=0;const fetchMock=vi.fn(async(path,options)=>{
    if(path.endsWith('/auth/me'))return response(200,{user:{nombre:'Recepción',rol:'RECEPCION'},csrfToken:'csrf'});
    if(path==='/api/v1/admin/menores')return response(200,[{id_menor:7,codigo:'FICTICIO',nombres:'Menor',apellido_paterno:'Prueba'}]);
    if(path.endsWith('/insumos/tipos'))return response(200,[{id_tipo_insumo:1,nombre:'Pañales',unidad:'pieza'}]);
    if(options?.method==='POST'){entries++;if(entries===1)throw new Error('Sin conexión');return response(201,{saldo_resultante:'2.000'});}
    return response(200,{revisados:true,insumos:[{id_insumo_menor:3,id_tipo_insumo:1,nombre:'Pañales',unidad:'pieza',cantidad_actual:'0.000',cantidad_requerida_ingreso:'2.000',obligatorio:true}]});
  });vi.stubGlobal('fetch',fetchMock);render(<MemoryRouter initialEntries={['/insumos?menor=7']}><App/></MemoryRouter>);
  await userEvent.selectOptions(await screen.findByLabelText('Insumo a reponer'),'3');await userEvent.type(screen.getByLabelText('Cantidad recibida'),'2');await userEvent.type(screen.getByLabelText('Motivo de la entrada'),'Reposición ficticia');await userEvent.click(screen.getByRole('button',{name:'Guardar entrada'}));
  await screen.findByText('Sin conexión');await userEvent.click(screen.getByRole('button',{name:'Guardar entrada'}));await screen.findByText('Entrada registrada. Saldo: 2.000');
  const posts=fetchMock.mock.calls.filter(([,o])=>o?.method==='POST');expect(posts[0][1].headers['Idempotency-Key']).toBe(posts[1][1].headers['Idempotency-Key']);
});
