import React,{createContext,useContext,useEffect,useState} from 'react';
import {api,setCsrf} from '../api/client.js';
const AuthContext=createContext(null);
export const useAuth=()=>useContext(AuthContext);
export function AuthProvider({children}){
  const [user,setUser]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const accept=data=>{setCsrf(data.csrfToken);setUser(data.user);setError('');};
  useEffect(()=>{const expired=()=>{setCsrf('');setUser(null);};window.addEventListener('guarderia:session-expired',expired);api('/auth/me').then(accept).catch(e=>{if(e.status!==401)setError('No se pudo conectar con el servidor. Recarga para reintentar.');}).finally(()=>setLoading(false));return()=>window.removeEventListener('guarderia:session-expired',expired);},[]);
  async function login(email,password){accept(await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})}));}
  async function logout(){await api('/auth/logout',{method:'POST'});setCsrf('');setUser(null);}
  return <AuthContext.Provider value={{user,loading,error,login,logout}}>{children}</AuthContext.Provider>;
}
