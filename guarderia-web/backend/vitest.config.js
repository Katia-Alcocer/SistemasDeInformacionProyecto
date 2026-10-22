import {defineConfig} from 'vitest/config';
// Cada archivo mantiene sus fixtures en mysql-test; no ejecutar el caso de
// último ADMIN de S1 a la vez que las sesiones de otros módulos.
export default defineConfig({test:{fileParallelism:false,testTimeout:15000,hookTimeout:30000}});
