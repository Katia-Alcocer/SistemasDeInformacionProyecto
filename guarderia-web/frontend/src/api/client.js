let csrfToken='';
export const setCsrf=value=>{csrfToken=value||'';};
export async function api(path,options={}){
  const response=await fetch(`/api/v1${path}`,{credentials:'include',...options,headers:{'Content-Type':'application/json',...(csrfToken?{'X-CSRF-Token':csrfToken}:{}),...options.headers}});
  if(response.status===204)return null;
  const body=await response.json();
  if(!response.ok){if(response.status===401&&path!=='/auth/login')window.dispatchEvent(new Event('guarderia:session-expired'));const error=new Error(body.message||'No se pudo realizar la operación');error.status=response.status;error.data=body.data;error.code=body.error?.code;throw error;}
  return body.data;
}
