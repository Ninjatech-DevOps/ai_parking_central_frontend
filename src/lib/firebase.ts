import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type MessagePayload } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

let messaging: ReturnType<typeof getMessaging> | null = null;

function getMessagingInstance() {
  if (!messaging) {
    messaging = getMessaging(app);
  }
  return messaging;
}

let swRegistration: ServiceWorkerRegistration | null = null;

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (swRegistration) return swRegistration;

  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers not supported");
  }

  swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  // Wait for the service worker to be ready
  await navigator.serviceWorker.ready;
  console.log("Firebase service worker registered");
  return swRegistration;
}

/**
 * Request notification permission and get FCM token.
 * Returns the token string, or null if permission denied / unsupported.
 */
export async function requestNotificationPermission(): Promise<string | null> {
  if (!("Notification" in window)) {
    console.warn("This browser does not support notifications");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.info("Notification permission denied");
    return null;
  }

  try {
    const sw = await ensureServiceWorker();
    const token = await getToken(getMessagingInstance(), {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: sw,
    });
    console.log("FCM token obtained:", token?.substring(0, 20) + "...");
    return token;
  } catch (err) {
    console.error("Failed to get FCM token:", err);
    return null;
  }
}

/**
 * Listen for foreground push messages.
 * Call this once after login — the callback fires when a push arrives while the app is in focus.
 */
export function onForegroundMessage(callback: (payload: MessagePayload) => void): () => void {
  const unsubscribe = onMessage(getMessagingInstance(), callback);
  return unsubscribe;
}
