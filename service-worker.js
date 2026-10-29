// НАПомни — единен Service Worker: офлайн кеш + FCM push в background
// Ако gstatic не се зареди, офлайн кешът трябва да продължи да работи
try{
  importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');
  firebase.initializeApp({apiKey:"AIzaSyCZ-M2rRZCA6mwcDLV0lxNpGa8gINrnjxE",authDomain:"napomni-abae3.firebaseapp.com",projectId:"napomni-abae3",storageBucket:"napomni-abae3.firebasestorage.app",messagingSenderId:"469508428647",appId:"1:469508428647:web:5b34a7bd7b2956d6a795c2"});
  // FCM показва notification payload-а автоматично; тук само data-only съобщения
  firebase.messaging().onBackgroundMessage(p=>{if(p.notification)return;const d=p.data||{};return self.registration.showNotification(d.title||'НАПомни',{body:d.body||'Предстоящ срок!',tag:'napomni-'+(d.deadlineId||'x'),vibrate:[200,100,200],requireInteraction:true});});
}catch(e){console.warn('FCM SW:',e.message);}
// Пътищата са спрямо папката на SW, за да работи и под /app/
const SCOPE=self.registration.scope;
const INDEX=new URL('index.html',SCOPE).href;
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs)if(c.url.startsWith(SCOPE)&&'focus' in c)return c.focus();if(clients.openWindow)return clients.openWindow(SCOPE);}));});

// ══ CACHE ══
// Смени версията при всеки deploy, за да се изчисти старият кеш
const CACHE='napomni-v5.4';
const ASSETS=[SCOPE,INDEX,new URL('manifest.json',SCOPE).href];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  // Кешираме само файловете на приложението; Firebase/Google заявките минават директно
  if(url.origin!==self.location.origin||!url.href.startsWith(SCOPE))return;
  // HTML — network-first, за да получават потребителите новата версия веднага
  if(req.mode==='navigate'||req.destination==='document'){
    const isApp=url.pathname===new URL(SCOPE).pathname||url.href.split('?')[0]===INDEX;
    e.respondWith(fetch(req).then(r=>{if(r.ok&&isApp){const cl=r.clone();caches.open(CACHE).then(c=>c.put(INDEX,cl));}return r;}).catch(()=>caches.match(isApp?INDEX:req).then(c=>c||caches.match(INDEX))));
    return;
  }
  // Останалото — cache-first с обновяване на заден план
  e.respondWith(caches.match(req).then(c=>{
    const net=fetch(req).then(r=>{if(r.ok){const cl=r.clone();caches.open(CACHE).then(ca=>ca.put(req,cl));}return r;}).catch(()=>c);
    return c||net;
  }));
});
