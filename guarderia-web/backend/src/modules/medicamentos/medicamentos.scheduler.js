// Un ciclo a la vez. La base conserva las pendientes; reiniciar vuelve a sincronizar.
export function startMedicationScheduler(service,{delay=30000,onError=()=>console.error('No se pudo sincronizar la programación de dosis')}={}){
  let stopped=false,timer,running;
  function tick(){running=service.synchronize().catch(onError).finally(()=>{if(!stopped){timer=setTimeout(tick,delay);timer.unref?.();}});}
  tick();return async()=>{stopped=true;clearTimeout(timer);await running;};
}
