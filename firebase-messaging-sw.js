// Firebase Messaging Service Worker
// Handles background push notifications when app is not in focus

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC8SJC7qUfbAD9bqIYodvChftMxug6FGow",
  authDomain: "taxalert-7929e.firebaseapp.com",
  projectId: "taxalert-7929e",
  storageBucket: "taxalert-7929e.firebasestorage.app",
  messagingSenderId: "307710022018",
  appId: "1:307710022018:web:09bfa425a2c1fd1295bf9b",
  measurementId: "G-HXM8JX7E3H"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Background message:', payload);
  
  const notifData = payload.notification || {};
  const title = notifData.title || '⚖️ НАПомни';
  const options = {
    body: notifData.body || 'Имате предстоящ срок!',
    icon: notifData.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'napomni-deadline',
    data: payload.data || {},
    actions: [
      { action: 'open', title: '📋 Отвори' },
      { action: 'dismiss', title: 'Отхвърли' }
    ],
    vibrate: [200, 100, 200],
    requireInteraction: true
  };

  return self.registration.showNotification(title, options);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Focus existing window if found
      for (const client of windowClients) {
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
