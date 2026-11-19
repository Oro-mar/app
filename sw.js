/* Mi Azúcar — funciona sin internet */
const CACHE='mi-azucar-v2';
const SHELL=['./','index.html','styles.css','app.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  const isFont=url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com';
  if(url.origin!==location.origin&&!isFont) return;
  // Red primero (para tener siempre la versión más nueva), caché si no hay internet
  e.respondWith(fetch(req).then(res=>{
    if(res&&(res.ok||res.type==='opaque')){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}
    return res;
  }).catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||(req.mode==='navigate'?caches.match('index.html'):undefined))));
});
