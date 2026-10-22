export function operationalTime(instant,zone){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(instant);
  const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return {date:`${values.year}-${values.month}-${values.day}`,time:`${values.hour}:${values.minute}:${values.second}`,utc:instant.toISOString().slice(0,19).replace('T',' ')};
}
