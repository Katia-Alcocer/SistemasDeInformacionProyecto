// Días completos disponibles. No inventar una tasa para ropa u otros variables.
export function supplyAlert(item){
  const balance=Math.round(Number(item.cantidad_actual)*1000);
  const rate=item.consumo_diario_estimado===null?null:Math.round(Number(item.consumo_diario_estimado)*1000);
  const days=balance===0?0:rate>0?Math.floor(balance/rate):null;
  return {...item,dias_estimados:days,nivel_aviso:days!==null&&days<=3?days:null,estimacion_disponible:days!==null};
}
