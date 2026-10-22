import React from 'react';
import {test,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import App from '../App.jsx';
import {medicationSound} from '../modules/medicamentos/sound.js';
const response=(status,data,message='Error')=>({status,ok:status<400,json:async()=>({data,message,error:null})});
const dose={id_administracion:9,id_tratamiento:3,id_receta:2,nombres:'Menor ficticio',apellido_paterno:'Prueba',medicamento:'Sustancia ficticia',dosis:'1.500',unidad:'ml',via:'ORAL',fecha_programada:'2026-10-21',hora:'08:30:00',estado:'PENDIENTE',presente:true,vencida:true,alerta:true,puede_aplicar:true,puede_registrar:true};
function setup(writer=async()=>response(200,{}),override={},role='EDUCADORA'){const mock=vi.fn(async(path,options)=>{
  if(path.endsWith('/auth/me'))return response(200,{user:{nombre:'Operador',rol:role},csrfToken:'csrf'});
  if(options?.method==='POST')return writer(options);
  return response(200,{fecha_operativa:'2026-10-21',hora_servidor:'08:30:00',dosis:[{...dose,...override}]});
});vi.stubGlobal('fetch',mock);render(<MemoryRouter initialEntries={['/medicamentos']}><App/></MemoryRouter>);return mock;}
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
test('dosis pendiente recuperada muestra alerta visual y exige cotejos antes del registro',async()=>{
  setup();await screen.findByRole('heading',{name:'Medicamentos y dosis'});await screen.findByText('Hay dosis pendientes cuyo horario ya llegó. Revisa cada registro.');await userEvent.click(screen.getByRole('button',{name:'Registrar resultado de dosis 9'}));
  expect(screen.getByLabelText('Cotejé la identidad del menor').required).toBe(true);expect(screen.getByLabelText('Revisé la prescripción y el horario antes de registrar el resultado').checked).toBe(false);expect(screen.getByLabelText('Dosis aplicada (ml)').value).toBe('1.500');
});
test('fallo de red conserva datos y clave; reintento no fabrica resultado exitoso',async()=>{
  let n=0;const mock=setup(async()=>{if(++n===1)throw new Error('Red interrumpida');return response(200,{estado:'APLICADA'});});await screen.findByRole('button',{name:'Registrar resultado de dosis 9'});await userEvent.click(screen.getByRole('button',{name:'Registrar resultado de dosis 9'}));
  await userEvent.type(screen.getByLabelText('Observaciones y motivo'),'Dosis documentada tras cotejo');await userEvent.click(screen.getByLabelText('Cotejé la identidad del menor'));await userEvent.click(screen.getByLabelText('Revisé la prescripción y el horario antes de registrar el resultado'));await userEvent.click(screen.getByRole('button',{name:'Guardar registro de dosis'}));await screen.findByText('Red interrumpida');expect(screen.queryByText('Resultado de dosis guardado')).toBeNull();await userEvent.click(screen.getByRole('button',{name:'Guardar registro de dosis'}));await screen.findByText('Resultado de dosis guardado');
  const posts=mock.mock.calls.filter(([,o])=>o?.method==='POST');expect(posts).toHaveLength(2);expect(posts[0][1].headers['Idempotency-Key']).toBe(posts[1][1].headers['Idempotency-Key']);expect(JSON.parse(posts[1][1].body)).toMatchObject({estado:'APLICADA',dosis_aplicada:1.5,confirmacion_identidad:true,confirmacion_prescripcion:true});
});
test('aplicación bloqueada ofrece omisión y nunca prellena una dosis aplicada',async()=>{
  setup(undefined,{puede_aplicar:false});await screen.findByRole('button',{name:'Registrar resultado de dosis 9'});await userEvent.click(screen.getByRole('button',{name:'Registrar resultado de dosis 9'}));expect(screen.getByLabelText('Estado de la dosis').value).toBe('OMITIDA');expect(screen.queryByLabelText('Dosis aplicada (ml)')).toBeNull();
});
test('audio se crea solo al activar, emite tono y cierra; antes de activar no reproduce',async()=>{
  const start=vi.fn(),close=vi.fn(async()=>{}),osc={frequency:{},connect:vi.fn(),start,stop:vi.fn(),disconnect:vi.fn()},gain={gain:{},connect:vi.fn(),disconnect:vi.fn()};
  const Audio=vi.fn(function(){return {state:'running',currentTime:0,destination:{},resume:async()=>{},createOscillator:()=>osc,createGain:()=>gain,close};});vi.stubGlobal('AudioContext',Audio);
  const sound=medicationSound();expect(Audio).not.toHaveBeenCalled();expect(sound.beep()).toBe(false);await sound.enable();expect(Audio).toHaveBeenCalledTimes(1);expect(sound.beep()).toBe(true);expect(start).toHaveBeenCalledTimes(1);sound.close();expect(close).toHaveBeenCalledTimes(1);
});
test('enfermería confirma suspensión con motivo y sin modificar prescripción',async()=>{
  const mock=setup(async()=>response(200,{suspendido:true}),{},'ENFERMERIA');await screen.findByText('Suspender tratamiento 3');await userEvent.click(screen.getByText('Suspender tratamiento 3'));await userEvent.type(screen.getByLabelText('Motivo de suspensión 3'),'Suspensión revisada con prescripción');await userEvent.click(screen.getByLabelText('Confirmo la suspensión del tratamiento 3'));await userEvent.click(screen.getByRole('button',{name:'Confirmar suspensión 3'}));
  const post=mock.mock.calls.find(([path,o])=>o?.method==='POST'&&path.endsWith('/tratamientos/3/suspension'));expect(JSON.parse(post[1].body)).toEqual({confirmacion:true,motivo:'Suspensión revisada con prescripción'});
});
