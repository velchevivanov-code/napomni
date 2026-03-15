importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');
firebase.initializeApp({apiKey:"AIzaSyC8SJC7qUfbAD9bqIYodvChftMxug6FGow",authDomain:"taxalert-7929e.firebaseapp.com",projectId:"taxalert-7929e",storageBucket:"taxalert-7929e.firebasestorage.app",messagingSenderId:"307710022018",appId:"1:307710022018:web:09bfa425a2c1fd1295bf9b"});
const messaging=firebase.messaging();
messaging.onBackgroundMessage(p=>{const n=p.notification||{};return self.registration.showNotification(n.title||'НАПомни',{body:n.body||'Предстоящ срок!',tag:'napomni',vibrate:[200,100,200],requireInteraction:true});});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window'}).then(cs=>{for(const c of cs)if('focus' in c)return c.focus();if(clients.openWindow)return clients.openWindow('/');}));});
