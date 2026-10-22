export function medicationSound(){
  let context;
  return {
    async enable(){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('Este navegador no dispone de audio. Usa las alertas visuales.');context??=new Audio();await context.resume();if(context.state!=='running')throw new Error('El navegador mantiene el audio suspendido');},
    beep(){if(context?.state!=='running')return false;const oscillator=context.createOscillator(),gain=context.createGain();oscillator.frequency.value=660;gain.gain.value=0.08;oscillator.connect(gain);gain.connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+0.25);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};return true;},
    close(){context?.close().catch(()=>{});context=undefined;},
  };
}
