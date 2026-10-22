export function validDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const parsed=new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
export function addMonths(date,months){
  const [year,month,day]=date.split('-').map(Number);
  const first=new Date(Date.UTC(year,month-1+months,1));
  const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  first.setUTCDate(Math.min(day,last));return first.toISOString().slice(0,10);
}
export function ageCategory(birth,today){
  if(!validDate(birth)||!validDate(today)||birth>today)return null;
  const days=(Date.parse(`${today}T00:00:00Z`)-Date.parse(`${birth}T00:00:00Z`))/86400000;
  if(days<30||today>=addMonths(birth,48))return null;
  for(let year=3;year>=0;year--)if(today>=addMonths(birth,year*12))return `G${year}`;
  return null;
}
