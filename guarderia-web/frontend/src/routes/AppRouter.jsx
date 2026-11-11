import React,{useState} from 'react';
import {Link,NavLink,Routes,Route,Navigate,useLocation,useNavigate} from 'react-router-dom';
import {AuthProvider,useAuth} from '../context/AuthContext.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import Button from '../Button.jsx';
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

const navGroups=[
  {label:'General',items:[{to:'/',label:'Inicio',roles:['ADMIN','RECEPCION','EDUCADORA','ENFERMERIA'],icon:'home'}]},
  {label:'Jornada',items:[
    {to:'/recepcion',label:'Recepción',roles:['ADMIN','RECEPCION'],icon:'checkin'},
    {to:'/salidas',label:'Salidas',roles:['ADMIN','RECEPCION'],icon:'checkout'},
    {to:'/retardos',label:'Avisos de retardo',roles:['ADMIN','RECEPCION'],icon:'clock'},
    {to:'/retardos/revisiones',label:'Revisiones',roles:['ADMIN'],icon:'review'},
    {to:'/enfermeria',label:'Enfermería',roles:['ADMIN','ENFERMERIA','RECEPCION'],icon:'care'},
    {to:'/autoridad',label:'Reportes internos',roles:['ADMIN'],icon:'report'},
  ]},
  {label:'Personas',items:[
    {to:'/expedientes',label:'Expedientes',roles:['ADMIN','RECEPCION'],icon:'people'},
    {to:'/preinscripciones',label:'Preinscripciones',roles:['ADMIN'],icon:'inbox'},
    {to:'/usuarios',label:'Personal',roles:['ADMIN'],icon:'staff'},
    {to:'/grupos',label:'Grupos',roles:['ADMIN'],icon:'groups'},
  ]},
  {label:'Aulas y cuidado',items:[
    {to:'/aula/actividades',label:'Actividades',roles:['ADMIN','EDUCADORA'],icon:'activity'},
    {to:'/aula/insumos',label:'Inventario de aula',roles:['ADMIN','EDUCADORA'],icon:'stock'},
    {to:'/medicamentos',label:'Medicamentos',roles:['ADMIN','EDUCADORA','ENFERMERIA'],icon:'medicine'},
    {to:'/comedor',label:'Comedor',roles:['ADMIN','EDUCADORA','ENFERMERIA'],icon:'meal'},
    {to:'/recetas',label:'Recetas y restricciones',roles:['ADMIN','ENFERMERIA'],icon:'record'},
  ]},
  {label:'Administración',items:[{to:'/finanzas',label:'Cuotas y pagos',roles:['ADMIN'],icon:'finance'}]},
];
const labels=Object.fromEntries(navGroups.flatMap(group=>group.items.map(item=>[item.to,item.label])));
const roleNames={ADMIN:'Administración',RECEPCION:'Recepción',EDUCADORA:'Educadora',ENFERMERIA:'Enfermería'};

function Icon({name}){
  const common={width:19,height:19,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true};
  const shapes={
    home:<><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-7h6v7"/></>,
    checkin:<><path d="M4 12h11M11 8l4 4-4 4"/><path d="M18 5h3v14h-3"/></>,checkout:<><path d="M20 12H9m4-4-4 4 4 4"/><path d="M6 5H3v14h3"/></>,
    clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,review:<><path d="M4 5h16M4 12h10M4 19h8"/><path d="m17 16 2 2 4-5"/></>,
    care:<><path d="M12 21s-8-4.5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6.5-8 11-8 11Z"/><path d="M8 12h8m-4-4v8"/></>,
    report:<><path d="M5 3h10l4 4v14H5z"/><path d="M14 3v5h5M8 13h8M8 17h8"/></>,
    people:<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v1"/></>,
    inbox:<><path d="M4 4h16v16H4zM4 13h4l2 3h4l2-3h4"/></>,staff:<><circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0M19 5l2 2-2 2"/></>,groups:<><circle cx="8" cy="9" r="3"/><circle cx="17" cy="9" r="3"/><path d="M2 20a6 6 0 0 1 12 0m1-5a6 6 0 0 1 7 5"/></>,
    activity:<><path d="M3 12h4l3-7 4 14 3-7h4"/></>,stock:<><path d="M4 7h16v14H4zM2 3h20v4H2z"/><path d="M9 12h6"/></>,medicine:<><path d="m9 4 11 11a4 4 0 0 1-6 6L3 10a4 4 0 0 1 6-6Z"/><path d="m7 14 6-6"/></>,meal:<><path d="M4 3v8a3 3 0 0 0 6 0V3M7 3v18M17 3v18m0-18c3 3 3 8 0 9"/></>,record:<><path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4"/></>,finance:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-13 5h4"/></>
  };
  return <svg {...common}>{shapes[name]||shapes.record}</svg>;
}

function Login(){
  const {login,user,error:connectionError}=useAuth(),navigate=useNavigate();
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  if(user)return <Navigate to="/" replace/>;
  async function submit(event){event.preventDefault();setBusy(true);setError('');const form=new FormData(event.currentTarget);try{await login(form.get('email'),form.get('password'));navigate('/');}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <div className="login-scene"><section className="login">
    <div className="login__brand"><span className="brand-mark" aria-hidden="true">✿</span><span>Guardería infantil <small>Gestión de guardería</small></span></div>
    <p className="eyebrow">Portal de equipo</p><h1>Iniciar sesión</h1><p className="login__intro">Inicia sesión para continuar con la jornada.</p>
    <form onSubmit={submit}>
      <label>Correo electrónico<input name="email" type="email" autoComplete="username" required maxLength={190}/></label>
      <label>Contraseña<input name="password" type="password" autoComplete="current-password" required maxLength={72}/></label>
      <p role="alert">{error||connectionError}</p>
      <Button type="submit" size="lg" loading={busy}>{busy?'Ingresando…':'Entrar'}</Button>
    </form>
    <p className="login__privacy">Acceso exclusivo para personal autorizado.</p>
  </section><div className="login-art" aria-hidden="true"><span className="sun"/><span className="cloud cloud--one"/><span className="cloud cloud--two"/><div className="hill hill--back"/><div className="hill hill--front"/><span className="login-art__caption">Un espacio seguro para crecer</span></div></div>;
}

function Dashboard(){
  const {user}=useAuth();
  const quick=navGroups.flatMap(group=>group.items).filter(item=>item.to!=='/'&&item.roles.includes(user.rol));
  return <div className="dashboard">
    <section className="welcome-card"><div><p className="eyebrow">Panel de trabajo · {roleNames[user.rol]}</p><h1>Bienvenido, {user.nombre}</h1><p>Todo lo necesario para acompañar una jornada segura y organizada.</p></div><span className="welcome-card__mark" aria-hidden="true">✿</span></section>
    <section><div className="section-heading"><div><p className="eyebrow">Accesos de tu perfil</p><h2>¿Qué necesitas hacer?</h2></div></div><div className="dashboard-grid">{quick.map((item,index)=><Link className={`dashboard-card dashboard-card--${index%4}`} key={item.to} to={item.to}><span className="dashboard-card__icon"><Icon name={item.icon}/></span><span className="dashboard-card__label">{item.label}</span><span className="dashboard-card__arrow" aria-hidden="true">→</span></Link>)}{user.rol==='ADMIN'&&<a className="dashboard-card dashboard-card--3" href="/reportes/grupos"><span className="dashboard-card__icon"><Icon name="report"/></span><span className="dashboard-card__label">Reporte de grupos</span><span className="dashboard-card__arrow" aria-hidden="true">→</span></a>}</div></section>
    {user.rol==='EDUCADORA'&&<p className="dashboard-note">Recuerda revisar los avisos de insumos y medicamentos programados al inicio de la jornada.</p>}
  </div>;
}

function Layout(){
  const {user,logout,loading}=useAuth();const [error,setError]=useState(''),[menuOpen,setMenuOpen]=useState(false);const location=useLocation();
  const currentLabel=labels[location.pathname]||'Inicio';
  if(loading)return <main className="loading-screen" role="status"><span className="loading-dot"/>Cargando sesión…</main>;
  if(!user)return <Routes><Route path="/login" element={<Login/>}/><Route path="*" element={<Navigate to="/login" replace/>}/></Routes>;
  const closeMenu=()=>setMenuOpen(false);
  return <div className="app-frame">
    <a className="skip-link" href="#main-content">Saltar al contenido</a>
    {menuOpen&&<button className="nav-scrim" type="button" aria-label="Cerrar navegación" onClick={closeMenu}/>}
    <aside className={`sidebar${menuOpen?' sidebar--open':''}`} aria-label="Navegación del sistema">
      <Link className="brand" to="/" onClick={closeMenu}><span className="brand-mark" aria-hidden="true">✿</span><span className="brand__text">Guardería infantil<small>Gestión de guardería</small></span></Link>
      <div className="sidebar__profile"><span className="avatar" aria-hidden="true">{(user.nombre||'U').trim().charAt(0).toUpperCase()}</span><span className="sidebar__person"><strong>{user.nombre}</strong><small>{roleNames[user.rol]||user.rol}</small></span></div>
      <nav className="side-nav" aria-label="Módulos">
        {navGroups.map(group=>{const items=group.items.filter(item=>item.roles.includes(user.rol));return items.length>0&&<div className="side-nav__group" key={group.label}><p className="side-nav__heading">{group.label}</p>{items.map(item=><NavLink key={item.to} to={item.to} end={item.to==='/'} onClick={closeMenu} className={({isActive})=>`side-nav__link${isActive?' is-active':''}`}><Icon name={item.icon}/><span>{item.label}</span></NavLink>)}</div>})}
        {user.rol==='ADMIN'&&<div className="side-nav__group"><p className="side-nav__heading">Consultas</p><a className="side-nav__link" href="/reportes/grupos"><Icon name="report"/><span>Reporte de grupos</span></a></div>}
      </nav>
      <div className="sidebar__footer"><span className="sidebar__status"><i/>Sistema local activo</span><span>Guardería · Operación diaria</span></div>
    </aside>
    <div className="main-column">
      <header className="topbar"><Button className="menu-toggle" variant="ghost" aria-label={menuOpen?'Cerrar menú':'Abrir menú'} aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}><span aria-hidden="true">☰</span></Button><div className="topbar__context"><span className="topbar__overline">Guardería infantil</span><strong>{currentLabel}</strong></div><div className="topbar__actions"><span className="role-chip">{roleNames[user.rol]||user.rol}</span><Button variant="outline" size="sm" onClick={()=>logout().catch(e=>setError(e.message))}>Cerrar sesión</Button></div></header>
      <main className="workspace" id="main-content" tabIndex="-1">{error&&<p role="alert">{error}</p>}<Routes>
        <Route path="/login" element={<Navigate to="/" replace/>}/><Route path="/" element={<ProtectedRoute><Dashboard/></ProtectedRoute>}/>
        <Route path="/usuarios" element={<ProtectedRoute admin><Management key="usuarios" kind="usuarios"/></ProtectedRoute>}/><Route path="/grupos" element={<ProtectedRoute admin><Management key="grupos" kind="grupos"/></ProtectedRoute>}/>
        <Route path="/expedientes" element={<ProtectedRoute roles={['ADMIN','RECEPCION']}><Expedientes/></ProtectedRoute>}/><Route path="/preinscripciones" element={<ProtectedRoute admin><Preinscripciones/></ProtectedRoute>}/>
        <Route path="/recepcion" element={<ProtectedRoute roles={['ADMIN','RECEPCION']}><Recepcion/></ProtectedRoute>}/><Route path="/insumos" element={<ProtectedRoute roles={['ADMIN','RECEPCION']}><Insumos/></ProtectedRoute>}/>
        <Route path="/recetas" element={<ProtectedRoute roles={['ADMIN','ENFERMERIA']}><Recetas/></ProtectedRoute>}/><Route path="/aula/insumos" element={<ProtectedRoute roles={['ADMIN','EDUCADORA']}><AulaInsumos/></ProtectedRoute>}/>
        <Route path="/aula/actividades" element={<ProtectedRoute roles={['ADMIN','EDUCADORA']}><Actividades/></ProtectedRoute>}/><Route path="/medicamentos" element={<ProtectedRoute roles={['ADMIN','EDUCADORA','ENFERMERIA']}><Medicamentos/></ProtectedRoute>}/>
        <Route path="/comedor" element={<ProtectedRoute roles={['ADMIN','EDUCADORA','ENFERMERIA']}><Comedor/></ProtectedRoute>}/><Route path="/salidas" element={<ProtectedRoute roles={['ADMIN','RECEPCION']}><Salidas/></ProtectedRoute>}/>
        <Route path="/retardos" element={<ProtectedRoute roles={['ADMIN','RECEPCION']}><Retardos/></ProtectedRoute>}/><Route path="/retardos/revisiones" element={<ProtectedRoute admin><Revisiones/></ProtectedRoute>}/>
        <Route path="/autoridad" element={<ProtectedRoute admin><Autoridad/></ProtectedRoute>}/><Route path="/finanzas" element={<ProtectedRoute admin><Finanzas/></ProtectedRoute>}/>
        <Route path="/enfermeria" element={<ProtectedRoute roles={['ADMIN','ENFERMERIA','RECEPCION']}><Enfermeria/></ProtectedRoute>}/>
        <Route path="*" element={<section className="not-found"><span className="not-found__code">404</span><h1>Página no encontrada</h1><p>El enlace no corresponde a una sección disponible.</p><Link to="/">Volver al inicio</Link></section>}/>
      </Routes></main>
    </div>
  </div>;
}
export default function AppRouter(){return <AuthProvider><Layout/></AuthProvider>;}
