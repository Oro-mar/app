(function(){
"use strict";

/* ===== Configuración del sitio =====
   Pon aquí tu WhatsApp (solo números, con código de país, ej. "5215551234567")
   y/o tu correo para que las solicitudes de negocios te lleguen directo. */
const CONTACT={whatsapp:'',email:''};

const MOMENTS=[
  {k:'ayunas',label:'En ayunas'},
  {k:'antes',label:'Antes de comer'},
  {k:'despues',label:'Después de comer'},
  {k:'dormir',label:'Antes de dormir'},
  {k:'otro',label:'Otro momento'}
];
const MLABEL=Object.fromEntries(MOMENTS.map(m=>[m.k,m.label]));
const TAGS=[
  {k:'comida',label:'Comí'},
  {k:'ejercicio',label:'Hice ejercicio'},
  {k:'medicina',label:'Tomé medicina'},
  {k:'insulina',label:'Me puse insulina'},
  {k:'enfermo',label:'Me sentí mal'},
  {k:'estres',label:'Estrés'}
];
const TLABEL=Object.fromEntries(TAGS.map(t=>[t.k,t.label]));
const DEFAULTS={unit:'mgdl',low:70,fastHigh:130,postHigh:180,bigText:false,name:'',theme:'auto',chartDays:14};
const LS_KEY='mi-azucar.v1';
const DAY=86400000;
const state={readings:[],settings:{...DEFAULTS},example:false};

/* ---------- utilidades ---------- */
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isMmol=()=>state.settings.unit==='mmol';
const unitTxt=()=>isMmol()?'mmol/L':'mg/dL';
const fmt=v=>isMmol()?(v/18).toFixed(1):String(Math.round(v));
const toMg=n=>isMmol()?n*18:n;
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const startOfDay=t=>{const d=new Date(t);d.setHours(0,0,0,0);return d.getTime()};
const timeTxt=t=>new Date(t).toLocaleTimeString('es',{hour:'numeric',minute:'2-digit'});
const avgOf=list=>list.reduce((a,r)=>a+r.v,0)/list.length;
function dayTxt(t){
  const d0=startOfDay(Date.now()),d=startOfDay(t);
  if(d===d0) return 'Hoy';
  if(d===d0-DAY) return 'Ayer';
  const s=new Date(t).toLocaleDateString('es',{weekday:'long',day:'numeric',month:'long'});
  return s.charAt(0).toUpperCase()+s.slice(1);
}
function agoTxt(t){
  const m=Math.round((Date.now()-t)/60000);
  if(m<1) return 'ahora mismo';
  if(m<60) return 'hace '+m+' min';
  const h=Math.round(m/60);
  if(h<24) return 'hace '+h+(h===1?' hora':' horas');
  const d=Math.round(h/24);
  return 'hace '+d+(d===1?' día':' días');
}
function status(r){
  const s=state.settings,v=r.v;
  if(v<54) return {k:'vlow',label:'Muy bajo'};
  if(v<s.low) return {k:'low',label:'Bajo'};
  const hi=(r.m==='ayunas'||r.m==='antes')?s.fastHigh:s.postHigh;
  if(v>250) return {k:'vhigh',label:'Muy alto'};
  if(v>hi) return {k:'high',label:'Alto'};
  return {k:'ok',label:'En rango'};
}
function advice(st){
  switch(st.k){
    case 'vlow': return '<b>Actúa ahora.</b>Toma 15 g de azúcar rápida (½ taza de jugo o refresco normal, o 3–4 tabletas de glucosa) y vuelve a medir en 15 minutos. Si no mejora o te sientes confundido, pide ayuda o llama al 911.';
    case 'low': return '<b>Está bajo.</b>Toma 15 g de azúcar rápida (½ taza de jugo o 3–4 tabletas de glucosa) y vuelve a medir en 15 minutos.';
    case 'vhigh': return '<b>Está muy alto.</b>Toma agua y sigue tu plan. Si se repite o te sientes mal, llama a tu médico.';
    case 'high': return '<b>Un poco alto.</b>Toma agua, muévete si puedes y sigue tu plan. Vuelve a medir más tarde.';
    default: return '<b>¡Bien hecho!</b>Estás dentro de tu meta. Sigue así.';
  }
}
function guessMoment(){
  const h=new Date().getHours();
  if(h>=4&&h<10) return 'ayunas';
  if(h>=21||h<4) return 'dormir';
  return 'antes';
}
const sorted=()=>state.readings.slice().sort((a,b)=>b.t-a.t);
function inWindow(days){const from=Date.now()-days*DAY;return state.readings.filter(r=>r.t>=from)}
function clean(r){
  if(!r||typeof r.v!=='number'||typeof r.t!=='number'||!isFinite(r.v)||!isFinite(r.t)) return null;
  return {id:String(r.id||uid()).slice(0,40),t:r.t,v:r.v,m:MLABEL[r.m]?r.m:'otro',n:String(r.n||'').slice(0,120),
    g:Array.isArray(r.g)?r.g.filter(k=>TLABEL[k]):[]};
}

/* ---------- datos de ejemplo (solo en memoria) ---------- */
function exampleData(){
  let seed=7;const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280};
  const out=[];
  for(let d=29;d>=0;d--){
    const bd=new Date();bd.setHours(0,0,0,0);bd.setDate(bd.getDate()-d);
    const base=bd.getTime();
    const plan=[['ayunas',7.2,108,22],['despues',14.5,158,40],['dormir',22,128,26]];
    plan.forEach(([m,h,mu,sp],i)=>{
      const t=base+h*3600000+Math.round(rnd()*40)*60000;
      if(t>Date.now()) return;
      let v=Math.round(mu+(rnd()-.45)*sp*2);
      if(d===5&&i===0) v=64;
      if(d===9&&i===1) v=214;
      if(d===18&&i===1) v=262;
      const g=i===1&&rnd()>.6?['comida']:(i===2&&rnd()>.7?['ejercicio']:[]);
      out.push({id:'ej'+d+i,t,v,m,n:'',g});
    });
  }
  return out;
}

/* ---------- almacenamiento ---------- */
function load(){
  try{
    const raw=localStorage.getItem(LS_KEY);
    if(raw){
      const o=JSON.parse(raw);
      if(Array.isArray(o.readings)) state.readings=o.readings.map(clean).filter(Boolean);
      if(o.settings) state.settings={...DEFAULTS,...o.settings};
    }
  }catch(e){}
}
let storageOk=true;
function save(){
  try{localStorage.setItem(LS_KEY,JSON.stringify({readings:state.example?[]:state.readings,settings:state.settings}));storageOk=true;}
  catch(e){if(storageOk) toast('No se pudo guardar en este navegador. Descarga un respaldo.');storageOk=false;}
}
// Pide al navegador que no borre los datos por falta de espacio
if(navigator.storage&&navigator.storage.persist){navigator.storage.persisted().then(p=>{if(!p) navigator.storage.persist().catch(()=>{})}).catch(()=>{});}

/* ---------- acciones ---------- */
function upsertReading(r){
  if(state.example){state.readings=[];state.example=false;}
  const i=state.readings.findIndex(x=>x.id===r.id);
  if(i>=0) state.readings[i]=r; else state.readings.push(r);
  save();render();
}
let lastDeleted=null;
function removeReading(id){
  const r=state.readings.find(x=>x.id===id);if(!r) return;
  if(state.example){toast('Este es un dato de ejemplo. Registra tu primera medición para empezar.');return;}
  state.readings=state.readings.filter(x=>x.id!==id);
  lastDeleted=r;save();render();
  toast('Medición borrada',true);
}
function undoDelete(){
  if(!lastDeleted) return;
  state.readings.push(lastDeleted);lastDeleted=null;
  save();render();hideToast();
}

/* ---------- render ---------- */
function render(){
  $('#exampleBanner').hidden=!state.example;
  const nm=(state.settings.name||'').trim();
  const h=new Date().getHours();
  const hi=h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches';
  $('#greet').textContent=nm?hi+', '+nm:'Tu registro de glucosa';
  renderHero();renderStats();renderTIR();renderChart();renderToday();renderHistory();renderMoments();renderA1c();
}
function renderHero(){
  const el=$('#hero');const list=sorted();
  if(!list.length){
    el.className='hero';
    el.innerHTML='<div class="meta">Aún no tienes mediciones</div><p class="advice"><b>Empieza hoy.</b>Toca “Registrar medición” cada vez que uses tu glucómetro. Solo toma unos segundos.</p>';
    return;
  }
  const r=list[0],st=status(r);
  let trend='';
  const prev=list.find(x=>x!==r&&x.m===r.m);
  if(prev){
    const d=r.v-prev.v;const th=isMmol()?0.3*18:5;
    trend=Math.abs(d)<th?'≈ igual que la anterior '+MLABEL[r.m].toLowerCase():(d>0?'▲ ':'▼ ')+fmt(Math.abs(d))+' vs. la anterior '+MLABEL[r.m].toLowerCase();
  }
  el.className='hero '+st.k;
  el.innerHTML=
    '<div class="meta">Última medición · '+esc(MLABEL[r.m])+' · '+agoTxt(r.t)+'</div>'+
    '<div class="reading"><span class="num">'+fmt(r.v)+'</span><span class="unit">'+unitTxt()+'</span><span class="status '+st.k+'">'+st.label+'</span></div>'+
    (trend?'<div class="trend">'+esc(trend)+'</div>':'')+
    '<p class="advice">'+advice(st)+'</p>';
}
function streak(){
  const days=new Set(state.readings.map(r=>startOfDay(r.t)));
  const d=new Date();d.setHours(0,0,0,0);
  if(!days.has(d.getTime())) d.setDate(d.getDate()-1);
  let n=0;
  while(days.has(d.getTime())){n++;d.setDate(d.getDate()-1);}
  return n;
}
function renderStats(){
  const w=inWindow(7);
  let avg='–',pct='–',lows=0;
  if(w.length){
    avg=fmt(avgOf(w));
    pct=Math.round(100*w.filter(r=>status(r).k==='ok').length/w.length);
    lows=w.filter(r=>r.v<state.settings.low).length;
  }
  const s=streak();
  $('#stats').innerHTML=
    '<div class="stat"><span class="v">'+avg+'<small>'+(w.length?unitTxt():'')+'</small></span><span class="l">Promedio · 7 días</span></div>'+
    '<div class="stat"><span class="v">'+pct+(w.length?'<small>%</small>':'')+'</span><span class="l">En tu meta · 7 días</span></div>'+
    '<div class="stat"><span class="v" style="color:'+(lows?'var(--low)':'inherit')+'">'+lows+'</span><span class="l">Bajos · 7 días</span></div>'+
    '<div class="stat"><span class="v">'+s+'<small>'+(s===1?'día':'días')+'</small></span><span class="l">Racha registrando</span></div>';
}
const TIR_CATS=[
  {k:'vlow',label:'Muy bajo',col:'var(--vlow)'},
  {k:'low',label:'Bajo',col:'var(--low)'},
  {k:'ok',label:'En meta',col:'var(--ok)'},
  {k:'high',label:'Alto',col:'var(--high)'},
  {k:'vhigh',label:'Muy alto',col:'var(--vhigh)'}
];
function tirData(days){
  const w=inWindow(days);const c={vlow:0,low:0,ok:0,high:0,vhigh:0};
  w.forEach(r=>c[status(r).k]++);
  return {n:w.length,c};
}
function renderTIR(){
  const {n,c}=tirData(30);
  $('#tirCard').hidden=!n;
  if(!n) return;
  $('#tirN').textContent=n+(n===1?' medición':' mediciones');
  const pct=k=>Math.round(100*c[k]/n);
  $('#tirBar').innerHTML=TIR_CATS.filter(x=>c[x.k]).map(x=>'<i style="width:'+(100*c[x.k]/n)+'%;background:'+x.col+'" title="'+x.label+' '+pct(x.k)+'%"></i>').join('');
  $('#tirBar').setAttribute('aria-label',TIR_CATS.map(x=>x.label+' '+pct(x.k)+'%').join(', '));
  $('#tirLegend').innerHTML=TIR_CATS.map(x=>'<div><i class="sw" style="background:'+x.col+'"></i>'+x.label+'<b>'+pct(x.k)+'%</b></div>').join('');
}
function chartSVG(days){
  const W=640,H=260,pl=50,pr=14,pt=14,pb=30;
  const end=startOfDay(Date.now())+DAY,start=end-days*DAY;
  const pts=state.readings.filter(r=>r.t>=start&&r.t<end).sort((a,b)=>a.t-b.t);
  const s=state.settings;
  const maxV=Math.max(300,...pts.map(p=>p.v)),minV=40;
  const x=t=>pl+(t-start)/(end-start)*(W-pl-pr);
  const y=v=>pt+(1-(Math.min(v,maxV)-minV)/(maxV-minV))*(H-pt-pb);
  const ticks=isMmol()?[54,108,180,270]:[50,100,150,200,250,300].filter(v=>v<=maxV);
  let g='<rect x="'+pl+'" y="'+y(s.postHigh)+'" width="'+(W-pl-pr)+'" height="'+(y(s.low)-y(s.postHigh))+'" fill="var(--band)"/>';
  ticks.forEach(v=>{g+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="var(--line)" stroke-width="1"/><text x="'+(pl-8)+'" y="'+(y(v)+4)+'" text-anchor="end" font-size="17" fill="var(--muted)">'+fmt(v)+'</text>';});
  const stepD=days<=7?1:days<=14?2:5;
  for(let i=0;i<days;i+=stepD){
    const t=start+i*DAY+DAY/2;const d=new Date(t);
    g+='<text x="'+x(t)+'" y="'+(H-8)+'" text-anchor="middle" font-size="17" fill="var(--muted)">'+d.getDate()+'/'+(d.getMonth()+1)+'</text>';
  }
  if(pts.length>1){
    const path=pts.map((p,i)=>(i?'L':'M')+x(p.t).toFixed(1)+' '+y(p.v).toFixed(1)).join(' ');
    g+='<path d="'+path+'" fill="none" stroke="var(--muted)" stroke-opacity=".45" stroke-width="1.6" stroke-linejoin="round"/>';
  }
  const col=k=>k==='ok'?'var(--ok)':(k==='low'||k==='vlow')?'var(--low)':'var(--high)';
  const rr=days>14?3.5:4.5;
  pts.forEach((p,i)=>{
    const last=i===pts.length-1;const k=status(p).k;
    g+='<circle cx="'+x(p.t).toFixed(1)+'" cy="'+y(p.v).toFixed(1)+'" r="'+(last?7:rr)+'" fill="'+col(k)+'" stroke="var(--surface)" stroke-width="'+(last?3:1.5)+'"><title>'+esc(fmt(p.v)+' '+unitTxt()+' · '+MLABEL[p.m]+' · '+new Date(p.t).toLocaleString('es'))+'</title></circle>';
  });
  if(!pts.length) g+='<text x="'+(W/2)+'" y="'+(H/2)+'" text-anchor="middle" font-size="16" fill="var(--muted)">Tus mediciones aparecerán aquí</text>';
  return '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Gráfica de glucosa de los últimos '+days+' días">'+g+'</svg>';
}
function renderChart(){
  const days=state.settings.chartDays||14;
  $('#chartTitle').textContent='Últimos '+days+' días';
  $$('#chartRange .chip').forEach(c=>c.setAttribute('aria-pressed',String(Number(c.dataset.days)===days)));
  $('#chart').innerHTML=chartSVG(days);
}
function rowHTML(r){
  const st=status(r);
  const tags=(r.g||[]).length?'<div class="rtags">'+r.g.map(k=>'<span class="tag">'+esc(TLABEL[k])+'</span>').join('')+'</div>':'';
  return '<li class="row"><div class="badge '+st.k+'">'+fmt(r.v)+'<small>'+st.label+'</small></div>'+
    '<button class="main" data-edit="'+esc(r.id)+'" aria-label="Editar medición de '+fmt(r.v)+'"><div class="what">'+esc(MLABEL[r.m])+'</div><div class="when">'+timeTxt(r.t)+'</div>'+(r.n?'<div class="note">'+esc(r.n)+'</div>':'')+tags+'</button>'+
    '<button class="icon-btn" data-del="'+esc(r.id)+'" aria-label="Borrar medición de '+fmt(r.v)+'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button></li>';
}
function renderToday(){
  const d0=startOfDay(Date.now());
  const list=sorted().filter(r=>r.t>=d0);
  $('#todayList').innerHTML=list.length?list.map(rowHTML).join(''):'<li class="empty">Hoy todavía no te has medido.</li>';
}
let histFilter='todos',histLimit=150;
function renderHistory(){
  const list=sorted().filter(r=>histFilter==='todos'||r.m===histFilter);
  if(!list.length){$('#historyList').innerHTML='<p class="empty">Sin mediciones todavía.</p>';return;}
  let html='',cur=null,group=[];
  const flush=()=>{if(!group.length) return;html+='<div class="day-h">'+esc(dayTxt(cur))+'<span>Promedio '+fmt(avgOf(group))+'</span></div><ul class="list">'+group.map(rowHTML).join('')+'</ul>';group=[];};
  list.slice(0,histLimit).forEach(r=>{const d=startOfDay(r.t);if(d!==cur){flush();cur=d;}group.push(r);});
  flush();
  if(list.length>histLimit) html+='<button class="btn btn-ghost btn-sm more-btn" id="histMore">Ver más ('+(list.length-histLimit)+')</button>';
  $('#historyList').innerHTML=html;
}
let rangeDays=7;
function renderMoments(){
  const w=inWindow(rangeDays);
  let html='<thead><tr><th>Momento</th><th class="n">Veces</th><th class="n">Promedio</th><th class="n">Más bajo</th><th class="n">Más alto</th></tr></thead><tbody>';
  MOMENTS.forEach(m=>{
    const g=w.filter(r=>r.m===m.k);
    if(!g.length) return;
    const vs=g.map(r=>r.v);
    html+='<tr><td>'+m.label+'</td><td class="n">'+g.length+'</td><td class="n"><b>'+fmt(avgOf(g))+'</b></td><td class="n">'+fmt(Math.min(...vs))+'</td><td class="n">'+fmt(Math.max(...vs))+'</td></tr>';
  });
  if(!w.length) html+='<tr><td colspan="5" class="muted">Sin mediciones en este periodo.</td></tr>';
  html+='</tbody>';
  $('#momentTable').innerHTML=html;
}
/* A1c estimada (fórmula ADAG: A1c = (promedio mg/dL + 46.7) / 28.7) */
function a1cEstimate(){
  const w=inWindow(90);
  if(w.length<14) return null;
  const span=(Math.max(...w.map(r=>r.t))-Math.min(...w.map(r=>r.t)))/DAY;
  if(span<14) return null;
  const avg=avgOf(w);
  return {a1c:(avg+46.7)/28.7,avg,n:w.length,days:Math.round(span)+1};
}
function renderA1c(){
  const e=a1cEstimate();const el=$('#a1cCard');
  if(!e){
    el.innerHTML='<h2>A1c estimada</h2><p class="muted small" style="margin:0">Cuando tengas al menos 14 mediciones en 2 semanas, aquí verás una estimación de tu A1c basada en tu promedio.</p>';
    return;
  }
  el.innerHTML='<h2>A1c estimada</h2><div class="a1c"><div class="big">'+e.a1c.toFixed(1)+'<small>%</small></div><div><div><b>Promedio '+fmt(e.avg)+' '+unitTxt()+'</b></div><div class="muted small">Con '+e.n+' mediciones de los últimos '+Math.min(e.days,90)+' días. Es solo una estimación: el análisis de laboratorio es el que cuenta.</div></div></div>';
}

/* ---------- ajustes ---------- */
function applySettings(){
  const s=state.settings;
  document.documentElement.classList.toggle('big',!!s.bigText);
  if(s.theme==='light'||s.theme==='dark') document.documentElement.dataset.theme=s.theme; else delete document.documentElement.dataset.theme;
  $$('[data-theme-set]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeSet===(s.theme||'auto'))));
  $('#setBig').setAttribute('aria-checked',String(!!s.bigText));
  $$('[data-unit]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.unit===s.unit)));
  if(document.activeElement!==$('#setName')) $('#setName').value=s.name||'';
  [['#setLow','low'],['#setFast','fastHigh'],['#setPost','postHigh']].forEach(([sel,k])=>{if(document.activeElement!==$(sel)) $(sel).value=fmt(s[k]);});
  $('#goalUnit').textContent='Valores en '+unitTxt()+'.';
  $('#entryUnit').textContent=unitTxt();
}
$$('[data-unit]').forEach(b=>b.addEventListener('click',()=>{state.settings.unit=b.dataset.unit;save();applySettings();render();}));
$$('[data-theme-set]').forEach(b=>b.addEventListener('click',()=>{state.settings.theme=b.dataset.themeSet;save();applySettings();}));
$('#setBig').addEventListener('click',()=>{state.settings.bigText=!state.settings.bigText;save();applySettings();});
$('#setName').addEventListener('change',e=>{state.settings.name=e.target.value.trim().slice(0,40);save();render();});
[['#setLow','low',40,100],['#setFast','fastHigh',90,200],['#setPost','postHigh',120,300]].forEach(([sel,k,mn,mx])=>{
  $(sel).addEventListener('change',e=>{
    const n=parseFloat(String(e.target.value).replace(',','.'));
    if(isFinite(n)){const mg=Math.round(toMg(n));if(mg>=mn&&mg<=mx){state.settings[k]=mg;save();render();}else toast('Ese valor está fuera de lo permitido ('+fmt(mn)+'–'+fmt(mx)+' '+unitTxt()+').');}
    e.target.value=fmt(state.settings[k]);
  });
});
$('#chartRange').addEventListener('click',e=>{const b=e.target.closest('[data-days]');if(!b) return;state.settings.chartDays=Number(b.dataset.days);save();renderChart();});

/* ---------- exportar ---------- */
function downloadFile(name,text,type){
  const blob=new Blob([text],{type});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
const stamp=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
function csvText(){
  const rows=[['Fecha','Hora','Glucosa ('+unitTxt()+')','Momento','Estado','Etiquetas','Nota']];
  sorted().forEach(r=>{const d=new Date(r.t);rows.push([d.toLocaleDateString('es'),timeTxt(r.t),fmt(r.v),MLABEL[r.m],status(r).label,(r.g||[]).map(k=>TLABEL[k]).join('; '),r.n||''])});
  return rows.map(row=>row.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
}
function summaryText(){
  const s=state.settings,w=inWindow(30),u=unitTxt();
  const lines=['Resumen de glucosa'+(s.name?' de '+s.name:'')+' · últimos 30 días',
    'Generado el '+new Date().toLocaleDateString('es',{day:'numeric',month:'long',year:'numeric'}),''];
  if(!w.length){lines.push('Sin mediciones en los últimos 30 días.');return lines.join('\n');}
  const e=a1cEstimate();
  lines.push('Mediciones: '+w.length,'Promedio: '+fmt(avgOf(w))+' '+u,
    'En meta: '+Math.round(100*w.filter(r=>status(r).k==='ok').length/w.length)+'%',
    'Bajos (<'+fmt(s.low)+'): '+w.filter(r=>r.v<s.low).length,
    'Altos: '+w.filter(r=>/high/.test(status(r).k)).length);
  if(e) lines.push('A1c estimada: '+e.a1c.toFixed(1)+'% (estimación, no sustituye laboratorio)');
  lines.push('','Promedio por momento:');
  MOMENTS.forEach(m=>{const g=w.filter(r=>r.m===m.k);if(g.length) lines.push('· '+m.label+': '+fmt(avgOf(g))+' '+u+' ('+g.length+' veces)');});
  lines.push('','Últimas mediciones:');
  sorted().slice(0,15).forEach(r=>lines.push('· '+new Date(r.t).toLocaleDateString('es')+' '+timeTxt(r.t)+' — '+fmt(r.v)+' '+u+' · '+MLABEL[r.m]+(r.n?' · '+r.n:'')));
  if(state.example) lines.push('','(Datos de ejemplo)');
  return lines.join('\n');
}
async function copy(text,okMsg,el){
  try{await navigator.clipboard.writeText(text);el.textContent=okMsg;}
  catch(e){el.textContent='Tu navegador no dejó copiar. Intenta de nuevo o usa otro navegador.';}
}
$('#copySummary').addEventListener('click',()=>copy(summaryText(),'Resumen copiado. Pégalo en un mensaje o correo para tu médico.',$('#exportMsg')));
$('#downloadCsv').addEventListener('click',()=>{downloadFile('mi-azucar-'+stamp()+'.csv','﻿'+csvText(),'text/csv;charset=utf-8');$('#exportMsg').textContent='Listo, tu tabla se descargó. Ábrela con Excel o Google Sheets.';});

/* Reporte imprimible */
function buildReport(){
  const s=state.settings,w=inWindow(30),u=unitTxt(),e=a1cEstimate();
  const {n,c}=tirData(30);
  let h='<h1>Reporte de glucosa'+(s.name?' · '+esc(s.name):'')+'</h1>';
  h+='<div>Últimos 30 días · generado el '+new Date().toLocaleDateString('es',{day:'numeric',month:'long',year:'numeric'})+' · unidad: '+u+'</div>';
  h+='<div>Metas: bajo &lt; '+fmt(s.low)+' · ayunas/antes de comer ≤ '+fmt(s.fastHigh)+' · después de comer ≤ '+fmt(s.postHigh)+'</div>';
  if(state.example) h+='<p><b>(Datos de ejemplo)</b></p>';
  if(!w.length){h+='<p>Sin mediciones en los últimos 30 días.</p>';$('#report').innerHTML=h;return;}
  h+='<h2>Resumen</h2><div class="kpis">'+
    '<div class="kpi">Promedio<b>'+fmt(avgOf(w))+' '+u+'</b></div>'+
    '<div class="kpi">En meta<b>'+Math.round(100*c.ok/n)+'%</b></div>'+
    '<div class="kpi">Bajos<b>'+(c.low+c.vlow)+'</b></div>'+
    '<div class="kpi">A1c estimada<b>'+(e?e.a1c.toFixed(1)+'%':'—')+'</b></div></div>';
  h+='<p>Tiempo por rango: '+TIR_CATS.map(x=>x.label+' '+Math.round(100*c[x.k]/n)+'%').join(' · ')+'</p>';
  h+='<h2>Gráfica</h2>'+chartSVG(30);
  h+='<h2>Promedio por momento</h2><table><tr><th>Momento</th><th>Veces</th><th>Promedio</th><th>Más bajo</th><th>Más alto</th></tr>';
  MOMENTS.forEach(m=>{const g=w.filter(r=>r.m===m.k);if(!g.length) return;const vs=g.map(r=>r.v);h+='<tr><td>'+m.label+'</td><td>'+g.length+'</td><td>'+fmt(avgOf(g))+'</td><td>'+fmt(Math.min(...vs))+'</td><td>'+fmt(Math.max(...vs))+'</td></tr>';});
  h+='</table><h2>Mediciones</h2><table><tr><th>Fecha</th><th>Hora</th><th>'+u+'</th><th>Momento</th><th>Estado</th><th>Nota</th></tr>';
  w.slice().sort((a,b)=>b.t-a.t).forEach(r=>{h+='<tr><td>'+new Date(r.t).toLocaleDateString('es')+'</td><td>'+timeTxt(r.t)+'</td><td><b>'+fmt(r.v)+'</b></td><td>'+MLABEL[r.m]+'</td><td>'+status(r).label+'</td><td>'+esc([...(r.g||[]).map(k=>TLABEL[k]),r.n].filter(Boolean).join(' · '))+'</td></tr>';});
  h+='</table><p style="margin-top:6mm;font-size:9pt">Generado con Mi Azúcar. Esta app ayuda a llevar el registro; no reemplaza la indicación médica.</p>';
  $('#report').innerHTML=h;
}
$('#printReport').addEventListener('click',()=>{buildReport();window.print();});
window.addEventListener('beforeprint',buildReport);

/* Respaldo */
$('#backupBtn').addEventListener('click',()=>{
  if(state.example||!state.readings.length){$('#backupMsg').textContent='Todavía no tienes mediciones propias para respaldar.';return;}
  downloadFile('mi-azucar-respaldo-'+stamp()+'.json',JSON.stringify({app:'mi-azucar',version:1,exported:Date.now(),readings:state.readings,settings:state.settings},null,1),'application/json');
  $('#backupMsg').textContent='Respaldo descargado ('+state.readings.length+' mediciones). Guárdalo en un lugar seguro.';
});
$('#restoreBtn').addEventListener('click',()=>$('#restoreFile').click());
$('#restoreFile').addEventListener('change',async e=>{
  const f=e.target.files&&e.target.files[0];e.target.value='';
  if(!f) return;
  try{
    if(f.size>5e6) throw new Error('big');
    const o=JSON.parse(await f.text());
    const list=(Array.isArray(o)?o:o.readings||[]).map(clean).filter(Boolean);
    if(!list.length) throw new Error('empty');
    const hadOwn=!state.example&&state.readings.length>0;
    if(state.example){state.readings=[];state.example=false;}
    const ids=new Set(state.readings.map(r=>r.id));
    let added=0;list.forEach(r=>{if(!ids.has(r.id)){state.readings.push(r);ids.add(r.id);added++;}});
    // En un dispositivo nuevo (sin datos propios) también se recuperan las metas y preferencias
    if(!hadOwn&&o.settings&&typeof o.settings==='object') state.settings={...DEFAULTS,...o.settings};
    save();applySettings();render();
    $('#backupMsg').textContent='Listo: se agregaron '+added+' mediciones'+(list.length-added?' ('+(list.length-added)+' ya estaban).':'.');
  }catch(x){$('#backupMsg').textContent='Ese archivo no parece un respaldo de Mi Azúcar.';}
});

function showWipeConfirm(){
  const box=$('#wipeBox');
  box.innerHTML='<p style="margin:0 0 10px;font-weight:700">¿Seguro? Esto borra todas tus mediciones y no se puede deshacer. Si quieres, descarga antes un respaldo.</p><div class="chips"><button class="btn btn-danger btn-sm" id="wipeYes">Sí, borrar todo</button><button class="btn btn-ghost btn-sm" id="wipeNo">Cancelar</button></div>';
  $('#wipeYes').onclick=()=>{
    state.readings=[];state.example=false;save();
    render();resetWipe();toast('Se borraron todas tus mediciones.');
  };
  $('#wipeNo').onclick=resetWipe;
}
function resetWipe(){$('#wipeBox').innerHTML='<button class="btn btn-danger btn-sm" id="wipeBtn">Borrar todas mis mediciones</button>';$('#wipeBtn').addEventListener('click',showWipeConfirm);}
$('#wipeBtn').addEventListener('click',showWipeConfirm);

/* ---------- hoja de registro ---------- */
let selMoment='antes',selTags=[],editingId=null,lastFocus=null;
function pad(n){return String(n).padStart(2,'0')}
function localDT(t){const d=new Date(t);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes())}
function renderMomentChips(){
  $('#momentChips').innerHTML=MOMENTS.map(m=>'<button type="button" class="chip" data-m="'+m.k+'" aria-pressed="'+(m.k===selMoment)+'">'+m.label+'</button>').join('');
}
function renderTagChips(){
  $('#tagChips').innerHTML=TAGS.map(t=>'<button type="button" class="chip" data-tag="'+t.k+'" aria-pressed="'+selTags.includes(t.k)+'">'+t.label+'</button>').join('');
}
function openEntry(r){
  lastFocus=document.activeElement;
  editingId=r?r.id:null;
  selMoment=r?r.m:guessMoment();selTags=r?(r.g||[]).slice():[];
  renderMomentChips();renderTagChips();
  $('#sheetTitle').textContent=r?'Editar medición':'Nueva medición';
  $('#entrySubmit').textContent=r?'Guardar cambios':'Guardar';
  $('#entryDelete').hidden=!r;
  $('#entryValue').value=r?fmt(r.v):'';$('#entryNote').value=r?r.n:'';$('#entryTime').value=localDT(r?r.t:Date.now());
  $('#entryTime').max=localDT(Date.now()+60000);
  $('#entryErr').hidden=true;$('#entryLive').innerHTML='';
  $('#overlay').classList.add('open');document.body.style.overflow='hidden';
  updateLive();
  setTimeout(()=>$('#entryValue').focus(),60);
}
function closeEntry(){$('#overlay').classList.remove('open');document.body.style.overflow='';editingId=null;if(lastFocus&&lastFocus.focus) lastFocus.focus();}
$$('[data-open-entry]').forEach(b=>b.addEventListener('click',()=>openEntry()));
$('#closeSheet').addEventListener('click',closeEntry);
$('#overlay').addEventListener('click',e=>{if(e.target.id==='overlay') closeEntry();});
document.addEventListener('keydown',e=>{
  if(!$('#overlay').classList.contains('open')) return;
  if(e.key==='Escape') closeEntry();
  if(e.key==='Tab'){ // mantener el foco dentro de la hoja
    const f=$$('#entryForm button:not([hidden]),#entryForm input');const first=f[0],last=f[f.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
});
$('#momentChips').addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(!b) return;selMoment=b.dataset.m;renderMomentChips();updateLive();});
$('#tagChips').addEventListener('click',e=>{const b=e.target.closest('[data-tag]');if(!b) return;const k=b.dataset.tag;selTags=selTags.includes(k)?selTags.filter(x=>x!==k):[...selTags,k];b.setAttribute('aria-pressed',String(selTags.includes(k)));});
function parseVal(){const n=parseFloat(String($('#entryValue').value).replace(',','.'));return isFinite(n)?n:null}
function updateLive(){
  const n=parseVal();const el=$('#entryLive');
  if(n===null){el.innerHTML='';return;}
  const mg=toMg(n);
  if(mg<20||mg>600){el.innerHTML='';return;}
  const st=status({v:mg,m:selMoment});
  el.innerHTML='<span class="status '+st.k+'">'+st.label+'</span>';
}
$('#entryValue').addEventListener('input',()=>{$('#entryErr').hidden=true;updateLive();});
$$('[data-step]').forEach(b=>b.addEventListener('click',()=>{
  const n=parseVal();const step=isMmol()?0.1:1;
  let v=(n===null?(isMmol()?6:110):n)+Number(b.dataset.step)*step;
  v=Math.max(0,v);$('#entryValue').value=isMmol()?v.toFixed(1):String(Math.round(v));updateLive();
}));
$('#entryForm').addEventListener('submit',e=>{
  e.preventDefault();
  const n=parseVal();const err=$('#entryErr');
  if(n===null){err.textContent='Escribe el número que marcó tu glucómetro.';err.hidden=false;$('#entryValue').focus();return;}
  const mg=toMg(n);
  if(mg<20||mg>600){err.textContent=isMmol()?'Revisa el número: debe estar entre 1.1 y 33.3 mmol/L.':'Revisa el número: debe estar entre 20 y 600 mg/dL.';err.hidden=false;return;}
  let t=Date.now();const tv=$('#entryTime').value;
  if(tv){const p=new Date(tv).getTime();if(isFinite(p)) t=p;}
  if(t>Date.now()+5*60000){err.textContent='La fecha y hora no pueden estar en el futuro.';err.hidden=false;return;}
  const wasEdit=!!editingId;
  upsertReading({id:editingId||uid(),t,v:Math.round(mg*10)/10,m:selMoment,n:$('#entryNote').value.trim().slice(0,120),g:selTags.slice()});
  closeEntry();
  if(!wasEdit){
    if(location.hash&&location.hash!=='#hoy') location.hash='hoy';
    window.scrollTo({top:0,behavior:'smooth'});
  }
  toast(wasEdit?'Cambios guardados':'Medición guardada');
});
$('#entryDelete').addEventListener('click',()=>{const id=editingId;closeEntry();removeReading(id);});

/* ---------- clics en listas ---------- */
document.addEventListener('click',e=>{
  const d=e.target.closest('[data-del]');if(d){removeReading(d.dataset.del);return;}
  const ed=e.target.closest('[data-edit]');
  if(ed){
    if(state.example){toast('Este es un dato de ejemplo. Registra tu primera medición para empezar.');return;}
    const r=state.readings.find(x=>x.id===ed.dataset.edit);if(r) openEntry(r);return;
  }
  if(e.target.id==='histMore'){histLimit+=150;renderHistory();}
});
$('#rangeChips').addEventListener('click',e=>{const b=e.target.closest('[data-range]');if(!b) return;rangeDays=Number(b.dataset.range);$$('#rangeChips .chip').forEach(c=>c.setAttribute('aria-pressed',String(c===b)));renderMoments();});
$('#histFilter').innerHTML='<option value="todos">Todos los momentos</option>'+MOMENTS.map(m=>'<option value="'+m.k+'">'+m.label+'</option>').join('');
$('#histFilter').addEventListener('change',e=>{histFilter=e.target.value;histLimit=150;renderHistory();});

/* ---------- aviso ---------- */
let toastTimer=null;
function toast(msg,undo){
  $('#toastTxt').textContent=msg;$('#toastUndo').hidden=!undo;$('#toast').classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(hideToast,undo?6000:3000);
}
function hideToast(){$('#toast').classList.remove('show');}
$('#toastUndo').addEventListener('click',undoDelete);

/* ---------- navegación ---------- */
function route(){
  const v=(location.hash||'#hoy').slice(1);
  const VIEWS=['hoy','historial','aprende','aliados','ajustes'];
  const view=VIEWS.includes(v)?v:(v==='anunciate'?'aliados':'hoy');
  VIEWS.forEach(k=>{$('#view-'+k).hidden=k!==view;});
  if(v==='anunciate') setTimeout(()=>$('#anunciate').scrollIntoView({behavior:'smooth'}),50);
  $$('[data-nav]').forEach(a=>{if(a.dataset.nav===view) a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
}
window.addEventListener('hashchange',()=>{const a=location.hash==='#anunciate';route();if(!a) window.scrollTo(0,0);});

/* ---------- Aprende ---------- */
const ICO={
  drop:'<path d="M12 3c3.3 4.2 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.7-6.8 6-11Z"/>',
  alert:'<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
  hand:'<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.2-2.3L3.5 14a1.5 1.5 0 0 1 2.5-1.6L8 15"/>',
  plate:'<circle cx="12" cy="12" r="9"/><path d="M12 3v18M12 12h9"/>',
  walk:'<circle cx="13" cy="4" r="2"/><path d="M10 22l2-7 3 3v4M8 12l2-4 4 1 2 4 3 1"/>',
  chart:'<path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6"/>',
  phone:'<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2"/>',
  foot:'<path d="M8 21c-2 0-3-2-3-5 0-4 1-7 3-9s4-1 4 2-1 4-1 7 1 5-3 5Z"/><circle cx="15" cy="5" r="1.4"/><circle cx="18" cy="8" r="1.2"/><circle cx="19.5" cy="11.5" r="1"/>',
  moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  pill:'<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="m8.5 8.5 7 7"/>'
};
const svgI=k=>'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICO[k]+'</svg>';
const LEARN=[
  {i:'alert',urgent:true,t:'Si tu azúcar está baja',s:'La regla 15-15',b:'<p>Un bajón (menos de 70 mg/dL) puede dar <b>temblor, sudor, mareo, hambre, latidos rápidos o confusión</b>.</p><ul><li>Come o toma <b>15 g de azúcar rápida</b>: ½ taza de jugo o refresco normal, 1 cucharada de azúcar o miel, o 3–4 tabletas de glucosa.</li><li>Espera <b>15 minutos</b> y vuelve a medirte.</li><li>Si sigues abajo de 70, repite.</li><li>Cuando suba, come algo si tu siguiente comida tarda más de una hora.</li></ul><p><b>Si la persona no puede tragar o pierde el conocimiento, llama al 911.</b></p>'},
  {i:'hand',t:'Cómo medirte bien',s:'Para que el número sea confiable',b:'<ul><li>Lávate las manos con agua y jabón, y sécalas bien. Restos de comida en los dedos pueden subir el resultado.</li><li>Pica a un lado de la yema del dedo: duele menos.</li><li>Revisa que las tiras no estén vencidas y guárdalas bien cerradas.</li><li>Anota el resultado enseguida en Mi Azúcar, con el momento del día.</li></ul>'},
  {i:'plate',t:'El método del plato',s:'Una forma fácil de servir tu comida',b:'<p>Usa un plato de unos 23 cm (9 pulgadas):</p><ul><li><b>La mitad:</b> verduras sin almidón, como lechuga, brócoli, nopales, calabacitas o jitomate.</li><li><b>Un cuarto:</b> proteína, como pollo, pescado, huevo o frijoles.</li><li><b>Un cuarto:</b> carbohidratos, como tortilla, arroz, papa o fruta.</li><li>Para tomar: agua o bebidas sin azúcar.</li></ul>'},
  {i:'walk',t:'Muévete un poco cada día',s:'Caminar también cuenta',b:'<p>Se recomienda juntar al menos <b>150 minutos a la semana</b> de actividad moderada, por ejemplo 30 minutos, 5 días.</p><ul><li>Una caminata de 10 a 15 minutos después de comer ayuda a bajar el azúcar.</li><li>Si usas insulina u otras medicinas que bajan el azúcar, mídete antes de hacer ejercicio y lleva algo dulce contigo.</li></ul>'},
  {i:'chart',t:'¿Qué es la A1c?',s:'Tu promedio de 2 a 3 meses',b:'<p>Es un análisis de sangre que muestra cómo ha estado tu azúcar en los últimos 2 a 3 meses. Para muchos adultos con diabetes, la meta común es <b>menos de 7%</b>, pero tu médico te dirá cuál es la tuya.</p><p>En <b>Historial</b> verás una A1c estimada con tus mediciones. Es una guía, no sustituye el análisis de laboratorio.</p>'},
  {i:'pill',t:'Tus medicinas',s:'Tomarlas bien hace la diferencia',b:'<ul><li>Tómalas a la misma hora todos los días; una alarma en el teléfono ayuda.</li><li>No dejes de tomarlas ni cambies la dosis sin hablar con tu médico, aunque te sientas bien.</li><li>Usa la etiqueta “Tomé medicina” o “Me puse insulina” al registrar: así verás cómo te afectan.</li></ul>'},
  {i:'moon',t:'Duerme bien',s:'El descanso también cuenta',b:'<ul><li>Dormir poco puede subir tu azúcar al día siguiente.</li><li>Intenta dormir de 7 a 9 horas, con horarios parecidos cada día.</li><li>Medirte antes de dormir ayuda a evitar bajones durante la noche.</li></ul>'},
  {i:'foot',t:'Cuida tus pies',s:'Revísalos todos los días',b:'<ul><li>Busca cortadas, ampollas, enrojecimiento o hinchazón.</li><li>Usa calzado cómodo y calcetines secos. No camines descalzo.</li><li>Si una herida no sana en unos días, avisa a tu médico.</li></ul>'},
  {i:'phone',urgent:true,t:'Cuándo llamar al médico',s:'Señales que no hay que dejar pasar',b:'<ul><li>Bajones seguidos, o uno que no se compone con la regla 15-15.</li><li>Azúcar mayor de 250 mg/dL en varias mediciones seguidas.</li><li>Mucha sed, orinar muy seguido, vómito, dolor de estómago o respiración rápida.</li></ul><p><b>Emergencia: confusión, desmayo o dificultad para respirar. Llama al 911.</b></p>'}
];
function renderLearn(){
  $('#learnList').innerHTML=LEARN.map(l=>'<details class="learn'+(l.urgent?' urgent':'')+'"><summary><span class="tip-ico">'+svgI(l.i)+'</span><span><span class="st">'+l.t+'</span><br><span class="ss">'+l.s+'</span></span><svg class="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="body">'+l.b+'</div></details>').join('');
}
function renderTip(){
  const idx=Math.floor(startOfDay(Date.now())/DAY)%LEARN.length;const l=LEARN[idx];
  const plain=l.b.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const short=plain.length>130?plain.slice(0,plain.lastIndexOf(' ',128))+'…':plain;
  $('#tipToday').innerHTML='<span class="tip-ico">'+svgI(l.i)+'</span><div><div class="eyebrow" style="margin:0">Consejo del día</div><p class="t">'+l.t+'</p><p class="muted small">'+esc(short)+'</p><a href="#aprende">Leer completo →</a></div>';
}

/* ---------- Negocios aliados (ejemplos) ---------- */
const ALLY_CATS=['Todos','Farmacia','Laboratorio','Nutrición','Ejercicio','Calzado','Comida'];
const ALLIES=[
  {n:'Farmacia La Salud',c:'Farmacia',o:'10% de descuento en tiras reactivas',m:'Muestra la app en caja. Entrega a domicilio sin costo en compras mayores a $300.',col:'#0B8F61',ini:'LS',plan:'Premium'},
  {n:'Laboratorio Clínico Central',c:'Laboratorio',o:'Prueba de A1c a precio especial',m:'Resultados el mismo día. Sin cita de lunes a sábado, de 7 a 11 am.',col:'#2347E6',ini:'LC',plan:'Destacado'},
  {n:'Nutrición Vital',c:'Nutrición',o:'Primera consulta con 20% de descuento',m:'Planes de alimentación para personas con diabetes. Consulta en persona o en línea.',col:'#C2410C',ini:'NV',plan:'Destacado'},
  {n:'Club Camina Conmigo',c:'Ejercicio',o:'Caminatas gratis los sábados, 8 am',m:'Grupo para todas las edades, con instructor. Salida desde el parque central.',col:'#7C3AED',ini:'CC',plan:'Básico'},
  {n:'Zapatería Paso Firme',c:'Calzado',o:'Calzado especial para pie diabético',m:'Asesoría gratis para elegir tu talla. 15% de descuento con la app.',col:'#0E7490',ini:'PF',plan:'Básico'},
  {n:'Cocina Ligera',c:'Comida',o:'Menú del día bajo en azúcar',m:'Comida casera con porciones medidas. Pedidos por teléfono.',col:'#B91C5C',ini:'CL',plan:'Básico'}
];
let allyCat='Todos';
function allyHTML(a,compact){
  return '<article class="card ally"><div class="ally-logo" style="background:'+a.col+'" aria-hidden="true">'+a.ini+'</div><div><div class="tags"><span class="tag">Patrocinado</span><span class="tag">Ejemplo</span></div><h3>'+esc(a.n)+'</h3><div class="cat">'+esc(a.c)+'</div><div class="offer">'+esc(a.o)+'</div>'+(compact?'':'<p class="more">'+esc(a.m)+'</p>')+'</div></article>';
}
function renderAllies(){
  $('#allyChips').innerHTML=ALLY_CATS.map(c=>'<button class="chip" data-cat="'+c+'" aria-pressed="'+(c===allyCat)+'">'+c+'</button>').join('');
  const order={Premium:0,Destacado:1,'Básico':2};
  const list=ALLIES.filter(a=>allyCat==='Todos'||a.c===allyCat).sort((a,b)=>order[a.plan]-order[b.plan]);
  $('#allyList').innerHTML=list.length?list.map(a=>allyHTML(a,false)).join(''):'<p class="empty">Pronto habrá negocios en esta categoría.</p>';
  const idx=Math.floor(startOfDay(Date.now())/DAY)%ALLIES.length;
  $('#featuredAlly').innerHTML='<div class="day-h" style="margin:4px 4px 8px">Aliado destacado <a href="#aliados" style="color:var(--accent);font-weight:700;text-decoration:none;font-size:.9rem">Ver todos →</a></div>'+allyHTML(ALLIES[idx],true);
}
$('#allyChips').addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(!b) return;allyCat=b.dataset.cat;renderAllies();});
const PLANS=[
  {n:'Básico',p:15,f:['Aparece en Negocios aliados','Tu oferta y datos de contacto']},
  {n:'Destacado',p:35,hot:true,f:['Todo lo del Básico','Arriba de la lista','Aliado destacado en la pantalla de inicio, algunos días al mes']},
  {n:'Premium',p:75,f:['Todo lo del Destacado','Primer lugar de tu categoría','Consejo patrocinado en Aprende']}
];
$('#plans').innerHTML=PLANS.map(p=>'<div class="plan'+(p.hot?' hot':'')+'">'+(p.hot?'<span class="badge-hot">Más elegido</span>':'')+'<span class="pn">'+p.n+'</span><span class="pp">$'+p.p+'<small> /mes</small></span><ul>'+p.f.map(x=>'<li>'+x+'</li>').join('')+'</ul></div>').join('');

/* ---------- Solicitudes de negocios ---------- */
function leadText(l){return 'Hola, me interesa anunciar mi negocio en Mi Azúcar.\nNegocio: '+l.biz+'\nContacto: '+l.contact+'\nPlan: '+l.plan+(l.msg?'\nMensaje: '+l.msg:'');}
$('#leadForm').addEventListener('submit',e=>{
  e.preventDefault();
  const l={biz:$('#leadBiz').value.trim(),contact:$('#leadContact').value.trim(),plan:$('#leadPlan').value,msg:$('#leadMsg').value.trim()};
  const err=$('#leadErr');
  if(!l.biz||!l.contact){err.textContent='Escribe el nombre del negocio y un teléfono o correo.';err.hidden=false;return;}
  err.hidden=true;
  const txt=leadText(l);
  let btns='';
  if(CONTACT.whatsapp) btns+='<a class="btn btn-primary btn-sm" target="_blank" rel="noopener" href="https://wa.me/'+encodeURIComponent(CONTACT.whatsapp.replace(/\D/g,''))+'?text='+encodeURIComponent(txt)+'">Enviar por WhatsApp</a>';
  if(CONTACT.email) btns+='<a class="btn btn-ghost btn-sm" href="mailto:'+encodeURIComponent(CONTACT.email)+'?subject='+encodeURIComponent('Anunciarme en Mi Azúcar')+'&body='+encodeURIComponent(txt)+'">Enviar por correo</a>';
  $('#leadResult').innerHTML='<div class="stack" style="gap:8px"><p style="margin:0"><b>'+(btns?'Tu mensaje está listo. Envíalo con un toque:':'Copia este mensaje y envíalo para recibir información:')+'</b></p><div class="copy-box">'+esc(txt)+'</div>'+btns+'<button type="button" class="btn btn-ghost btn-sm" id="leadCopy">Copiar mensaje</button></div>';
  $('#leadCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(txt);$('#leadCopy').textContent='Copiado';}catch(x){$('#leadCopy').textContent='Selecciona el texto y cópialo';}});
});

/* ---------- instalar como app (PWA) ---------- */
let installEvt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;$('#installBtn').hidden=false;});
$('#installBtn').addEventListener('click',async()=>{if(!installEvt) return;installEvt.prompt();try{await installEvt.userChoice;}catch(x){}installEvt=null;$('#installBtn').hidden=true;});
window.addEventListener('appinstalled',()=>{$('#installBtn').hidden=true;toast('¡Listo! Mi Azúcar quedó instalada.');});
if('serviceWorker' in navigator&&location.protocol.startsWith('http')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

/* ---------- sincronizar entre pestañas ---------- */
window.addEventListener('storage',e=>{if(e.key===LS_KEY){state.readings=[];state.settings={...DEFAULTS};load();if(!state.readings.length){state.readings=exampleData();state.example=true;}else state.example=false;applySettings();render();}});

/* ---------- inicio ---------- */
load();
if(!state.readings.length){state.readings=exampleData();state.example=true;}
applySettings();route();render();renderLearn();renderTip();renderAllies();
setInterval(()=>{renderHero();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden) render();});
})();
