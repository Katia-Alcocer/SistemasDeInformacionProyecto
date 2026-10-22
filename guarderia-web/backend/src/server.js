import {createDatabase} from './config/database.js';
import {createApp} from './app.js';
import {securityConfig} from './config/env.js';
import {medicamentosService} from './modules/medicamentos/medicamentos.service.js';
import {startMedicationScheduler} from './modules/medicamentos/medicamentos.scheduler.js';
import {autoridadService} from './modules/autoridad/autoridad.service.js';
import {startAuthorityScheduler} from './modules/autoridad/autoridad.scheduler.js';
const database = createDatabase();
const config=securityConfig();
const stopScheduler=startMedicationScheduler(medicamentosService(database,config));
const stopAuthority=startAuthorityScheduler(autoridadService(database,config));
const server = createApp(database,config).listen(3000,'0.0.0.0',() => console.info('API escuchando en puerto 3000'));
for (const signal of ['SIGTERM','SIGINT']) process.once(signal,() => {
  setTimeout(() => process.exit(1),10000).unref();
  server.close(async () => {await Promise.all([stopScheduler(),stopAuthority()]);await database.end(); process.exit(0);});
});
