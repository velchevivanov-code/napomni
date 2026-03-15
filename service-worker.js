const CACHE='napomni-v4.0';
const ASSETS=['/','/index.html','/manifest.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
  if(e.request.url.includes('firestore')||e.request.url.includes('firebase')||e.request.url.includes('googleapis')){e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));return;}
  e.respondWith(caches.match(e.request).then(c=>{if(c)return c;return fetch(e.request).then(r=>{if(r.ok){const cl=r.clone();caches.open(CACHE).then(ca=>ca.put(e.request,cl));}return r;});}).catch(()=>{if(e.request.destination==='document')return caches.match('/index.html');}));
});
