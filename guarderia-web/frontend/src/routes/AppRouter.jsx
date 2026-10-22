import React,{useState} from 'react';
import {Link,Routes,Route,Navigate,useNavigate} from 'react-router-dom';
import {AuthProvider,useAuth} from '../context/AuthContext.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import Management from '../modules/administracion/Management.jsx';
import Expedientes from '../modules/menores/Expedientes.jsx';
import Preinscripciones from '../modules/preinscripciones/Preinscripciones.jsx';
import Recepcion from '../modules/recepcion/Recepcion.jsx';
import Recetas from '../modules/recetas/Recetas.jsx';
import Insumos from '../modules/insumos/Insumos.jsx';
import AulaInsumos from '../modules/aulas/AulaInsumos.jsx';
import Actividades from '../modules/aulas/Actividades.jsx';
import Medicamentos from '../modules/medicamentos/Medicamentos.jsx';
import Comedor from '../modules/comedor/Comedor.jsx';
import Salidas from '../modules/salidas/Salidas.jsx';
import Enfermeria from '../modules/enfermeria/Enfermeria.jsx';
import Retardos from '../modules/retardos/Retardos.jsx';
import Revisiones from '../modules/retardos/Revisiones.jsx';
import Autoridad from '../modules/autoridad/Autoridad.jsx';
import Finanzas from '../modules/pagos/Finanzas.jsx';
function Login(){
  const {login,user,error:connectionError}=useAuth(),navigate=useNavigate();
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  if(user)return <Navigate to="/" replace/>;
  async function submit(event){event.preventDefault();setBusy(true);setError('');const form=new FormData(event.currentTarget);try{await login(form.get('email'),form.get('password'));navigate('/');}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <section className="login"><p>Guardería infantil</p><h1>Iniciar sesión</h1><form onSubmit={submit}><label>Correo electrónico<input name="email" type="email" autoComplete="username" required maxLength={190}/></label><label>Contraseña<input name="password" type="password" autoComplete="current-password" required maxLength={72}/></label><p role="alert">{error||connectionError}</p><button disabled={busy}>{busy?'Ingresando…':'Entrar'}</button></form></section>;
}
function Dashboard(){const {user}=useAuth();return <section><h1>Bienvenido, {user.nombre}</h1><p>Tu perfil: {user.rol}</p><div className="cards">{['ADMIN','RECEPCION'].includes(user.rol)&&<><Link to="/recepcion">Recepción e inspección</Link><Link to="/insumos">Insumos de recepción</Link><Link to="/expedientes">Expedientes infantiles</Link></>}{['ADMIN','ENFERMERIA'].includes(user.rol)&&<Link to="/recetas">Recetas y restricciones</Link>}{user.rol==='ADMIN'&&<><Link to="/preinscripciones">Preinscripciones</Link><Link to="/usuarios">Gestionar personal</Link><Link to="/grupos">Gestionar grupos</Link><a href="/reportes/grupos" target="_blank" rel="noreferrer">Reporte de grupos</a></>}</div>{user.rol==='EDUCADORA'&&<p>Tu inventario de aula está disponible en el acceso superior.</p>}</section>;}
function Layout(){
  const {user,logout,loading}=useAuth();const [error,setError]=useState('');
  if(loading)return <main role="status">Cargando sesión…</main>;
  return <><header><Link to="/">Guardería infantil</Link>{user&&<nav aria-label="Principal"><Link to="/">Inicio</Link>{['ADMIN','RECEPCION'].includes(user.rol)&&<><Link to="/recepcion">Recepción</Link><Link to="/salidas">Salidas</Link><Link to="/insumos">Insumos</Link><Link to="/expedientes">Expedientes</Link></>}{['ADMIN','ENFERMERIA'].includes(user.rol)&&<Link to="/recetas">Recetas</Link>}{user.rol==='ADMIN'&&<><Link to="/preinscripciones">Preinscripciones</Link><Link to="/usuarios">Personal</Link><Link to="/grupos">Grupos</Link></>}<button onClick={()=>logout().catch(e=>setError(e.message))}>Cerrar sesión</button></nav>}</header><main>{error&&<p role="alert">{error}</p>}{user&&['ADMIN','EDUCADORA'].includes(user.rol)&&<p><Link to="/aula/insumos">Inventario de aula</Link> · <Link to="/aula/actividades">Actividades de aula</Link></p>}{user&&['ADMIN','EDUCADORA','ENFERMERIA'].includes(user.rol)&&<p><Link to="/medicamentos">Medicamentos y dosis</Link> · <Link to="/comedor">Comedor</Link></p>}{user&&['ADMIN','ENFERMERIA','RECEPCION'].includes(user.rol)&&<p><Link to="/enfermeria">Enfermería y recolección</Link></p>}<Routes>
    <Route path="/login" element={<Login/>}/><Route path="/" element={<ProtectedRoute>{user?.rol==="ADMIN"&&<p><Link to="/finanzas">Cuotas y pagos</Link></p>}<Dashboard/></ProtectedRoute>}/>
    <Route path="/usuarios" element={<ProtectedRoute admin><Management key="usuarios" kind="usuarios"/></ProtectedRoute>}/><Route path="/grupos" element={<ProtectedRoute admin><Management key="grupos" kind="grupos"/></ProtectedRoute>}/>
    <Route path="/expedientes" element={<ProtectedRoute roles={['ADMIN','RECEPCION']}><Expedientes/></ProtectedRoute>}/>
    <Route path="/preinscripciones" element={<ProtectedRoute admin><Preinscripciones/></ProtectedRoute>}/>
    <Route path="/recepcion" element={<ProtectedRoute roles={['ADMIN','RECEPCION']}><Recepcion/></ProtectedRoute>}/>
    <Route path="/insumos" element={<ProtectedRoute roles={['ADMIN','RECEPCION']}><Insumos/></ProtectedRoute>}/>
    <Route path="/recetas" element={<ProtectedRoute roles={['ADMIN','ENFERMERIA']}><Recetas/></ProtectedRoute>}/>
    <Route path="/aula/insumos" element={<ProtectedRoute roles={['ADMIN','EDUCADORA']}><AulaInsumos/></ProtectedRoute>}/>
    <Route path="/aula/actividades" element={<ProtectedRoute roles={['ADMIN','EDUCADORA']}><Actividades/></ProtectedRoute>}/>
    <Route path="/medicamentos" element={<ProtectedRoute roles={['ADMIN','EDUCADORA','ENFERMERIA']}><Medicamentos/></ProtectedRoute>}/>
    <Route path="/comedor" element={<ProtectedRoute roles={['ADMIN','EDUCADORA','ENFERMERIA']}><Comedor/></ProtectedRoute>}/>
    <Route path="/salidas" element={<ProtectedRoute roles={['ADMIN','RECEPCION']}><p><Link to="/retardos">Avisos de llegada tardía</Link></p><Salidas/></ProtectedRoute>}/>
    <Route path="/retardos" element={<ProtectedRoute roles={['ADMIN','RECEPCION']}>{user?.rol==='ADMIN'&&<p><Link to="/retardos/revisiones">Revisar justificaciones y contador anual</Link></p>}<Retardos/></ProtectedRoute>}/>
    <Route path="/retardos/revisiones" element={<ProtectedRoute admin><p><Link to="/autoridad">Reportes internos de autoridad</Link></p><Revisiones/></ProtectedRoute>}/>
    <Route path="/autoridad" element={<ProtectedRoute admin><p><Link to="/finanzas">Cuotas y pagos</Link></p><Autoridad/></ProtectedRoute>}/>
    <Route path="/finanzas" element={<ProtectedRoute admin><Finanzas/></ProtectedRoute>}/>
    <Route path="/enfermeria" element={<ProtectedRoute roles={['ADMIN','ENFERMERIA','RECEPCION']}><Enfermeria/></ProtectedRoute>}/>
    <Route path="*" element={<p>Página no encontrada. <Link to="/">Volver al inicio</Link></p>}/>
  </Routes></main></>;
}
export default function AppRouter(){return <AuthProvider><Layout/></AuthProvider>;}
