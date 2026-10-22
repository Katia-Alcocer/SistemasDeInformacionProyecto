import {defineConfig} from 'vite';
export default defineConfig({server:{port:5173,strictPort:true,allowedHosts:['frontend'],proxy:{'/api':{target:'http://backend:3000'},'/reportes':{target:'http://backend:3000'}}}});
