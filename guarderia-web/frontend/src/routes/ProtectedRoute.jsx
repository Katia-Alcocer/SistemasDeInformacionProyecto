import React from 'react';
import {Navigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';
export default function ProtectedRoute({children,admin=false,roles=null}){const {user,loading}=useAuth();if(loading)return <p role="status">Cargando sesión…</p>;if(!user)return <Navigate to="/login" replace/>;if((admin&&user.rol!=='ADMIN')||(roles&&!roles.includes(user.rol)))return <p role="alert">No tienes permiso para esta sección.</p>;return children;}
