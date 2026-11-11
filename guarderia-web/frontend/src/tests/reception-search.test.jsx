import React from 'react';
import {test,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import App from '../App.jsx';

afterEach(()=>{cleanup();vi.unstubAllGlobals();});

test('recepción explica que un código no se puede buscar como ID y no envía la solicitud inválida',async()=>{
  const fetchMock=vi.fn(async()=>({status:200,ok:true,json:async()=>({data:{user:{nombre:'Recepción',rol:'RECEPCION'},csrfToken:'csrf'},message:'OK',error:null})}));
  vi.stubGlobal('fetch',fetchMock);
  render(<MemoryRouter initialEntries={['/recepcion']}><App/></MemoryRouter>);

  await userEvent.selectOptions(await screen.findByLabelText('Buscar por'),'ID');
  await userEvent.type(screen.getByLabelText('ID numérico del menor'),'DEMO-2026-002');
  fireEvent.submit(screen.getByRole('button',{name:'Buscar menor'}).closest('form'));

  expect((await screen.findByRole('alert')).textContent).toContain('El ID debe ser numérico');
  expect(fetchMock.mock.calls.some(([url])=>String(url).includes('/recepcion/menor/'))).toBe(false);
  expect(screen.getByLabelText('ID numérico del menor').placeholder).toBe('Ej. 5');
});
