importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');
firebase.initializeApp({apiKey:"AIzaSyCZ-M2rRZCA6mwcDLV0lxNpGa8gINrnjxE",authDomain:"napomni-abae3.firebaseapp.com",projectId:"napomni-abae3",storageBucket:"napomni-abae3.firebasestorage.app",messagingSenderId:"469508428647",appId:"1:469508428647:web:5b34a7bd7b2956d6a795c2"});
const messaging=firebase.messaging();
messaging.onBackgroundMessage(p=>{const n=p.notification||{};return self.registration.showNotification(n.title||'НАПомни',{body:n.body||'Предстоящ срок!',tag:'napomni',vibrate:[200,100,200],requireInteraction:true});});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window'}).then(cs=>{for(const c of cs)if('focus' in c)return c.focus();if(clients.openWindow)return clients.openWindow('/');}));});
