/* eslint-disable no-undef */

// Import Firebase compat scripts (required for service worker context)
importScripts("https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js");

// Initialize Firebase in the service worker
// NOTE: Only messaging-related config is needed here
firebase.initializeApp({
  apiKey: "AIzaSyBCbgr0-1O3pOV5seEymwLm07uqvydIol8",
  authDomain: "ai-parking-60ed8.firebaseapp.com",
  projectId: "ai-parking-60ed8",
  storageBucket: "ai-parking-60ed8.firebasestorage.app",
  messagingSenderId: "729212403218",
  appId: "1:729212403218:web:2234d07c05b15eeda5a2cb",
});

const messaging = firebase.messaging();

// Handle background push messages (when app is not in focus)
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Background message received:", payload);

  const title = payload.notification?.title || "AI Parking Alert";
  const body = payload.notification?.body || "";

  const options = {
    body: body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: "ai-parking-" + Date.now(),
    data: payload.data || {},
    requireInteraction: true,
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked");
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/") && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow("/alerts");
    })
  );
});
