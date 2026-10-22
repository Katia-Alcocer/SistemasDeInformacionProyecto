export function startAuthorityScheduler(service,{delay=30000,onError=()=>console.error('No se pudo sincronizar el control de salidas')}={}){
 let stopped=false,timer,running;
 function tick(){running=service.synchronize().catch(onError).finally(()=>{if(!stopped){timer=setTimeout(tick,delay);timer.unref?.();}});}
 tick();return async()=>{stopped=true;clearTimeout(timer);await running;};
}
