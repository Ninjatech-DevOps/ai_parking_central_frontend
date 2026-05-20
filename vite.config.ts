import path from "path"
import fs from "fs"
import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

function generateFirebaseSW(env: Record<string, string>) {
  const content = `/* eslint-disable no-undef */

// Import Firebase compat scripts (required for service worker context)
importScripts("https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js");

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: "${env.VITE_FIREBASE_API_KEY}",
  authDomain: "${env.VITE_FIREBASE_AUTH_DOMAIN}",
  projectId: "${env.VITE_FIREBASE_PROJECT_ID}",
  storageBucket: "${env.VITE_FIREBASE_STORAGE_BUCKET}",
  messagingSenderId: "${env.VITE_FIREBASE_MESSAGING_SENDER_ID}",
  appId: "${env.VITE_FIREBASE_APP_ID}",
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
`;
  fs.writeFileSync(
    path.resolve(__dirname, "public/firebase-messaging-sw.js"),
    content,
    "utf-8"
  );
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "generate-firebase-sw",
        buildStart() {
          generateFirebaseSW(env);
        },
        configureServer() {
          generateFirebaseSW(env);
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 3000,
      allowedHosts: ["aiparkingcentralfe.kl.business"],
      proxy: {
        "/api": {
          target: "http://localhost:8100",
          changeOrigin: true,
        },
      },
    },
  };
});
