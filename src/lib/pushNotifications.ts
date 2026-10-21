// PWA push notifications through Firebase Cloud Messaging (free tier).
// Values come from .env (VITE_FIREBASE_*) — Firebase console → Project settings.
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, deleteToken, isSupported } from "firebase/messaging";
import api from "@/apis/api";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let app: FirebaseApp | null = null;

export const pushSupported = async () =>
  Boolean(firebaseConfig.apiKey && VAPID_KEY) &&
  "Notification" in window &&
  "serviceWorker" in navigator &&
  (await isSupported());

// Why push can't work on this device, in French for the user (null when it can)
export const pushUnsupportedReason = async (): Promise<string | null> => {
  if (await pushSupported()) return null;
  if (!firebaseConfig.apiKey || !VAPID_KEY) {
    return "Firebase n'est pas configuré (fichier .env manquant lors du build).";
  }
  if (!window.isSecureContext) {
    return "Les notifications nécessitent une connexion sécurisée (https://). Ouvrez l'application via son adresse https.";
  }
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (isIos && !standalone) {
    return "Sur iPhone : touchez Partager → « Sur l'écran d'accueil », puis ouvrez l'application depuis son icône pour activer les notifications.";
  }
  return "Ce navigateur ne prend pas en charge les notifications. Utilisez Chrome (Android) ou l'application installée (iPhone, iOS 16.4+).";
};

const getFcmToken = async () => {
  app ??= initializeApp(firebaseConfig);
  // Use the app's own service worker (public/serviceworker.js) instead of firebase-messaging-sw.js
  const registration = await navigator.serviceWorker.register("/serviceworker.js");
  await navigator.serviceWorker.ready;
  return getToken(getMessaging(app), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
};

// Asks permission if needed, then saves this device's token for the logged-in user.
// Returns the resulting permission ("granted" / "denied" / "default").
// The navbar mounts two notification widgets (desktop bell + phone popup): share one in-flight
// call so they don't create and register two different tokens at the same time.
let pending: Promise<NotificationPermission> | null = null;

export const enablePushNotifications = (): Promise<NotificationPermission> => {
  pending ??= registerDevice().finally(() => {
    pending = null;
  });
  return pending;
};

const registerDevice = async (): Promise<NotificationPermission> => {
  if (!(await pushSupported())) return "denied";

  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== "granted") return permission;

  const token = await getFcmToken();
  if (token) await api.post("/notifications/register", { token });
  return permission;
};

// Call before logout so this device stops receiving the user's notifications
export const disablePushNotifications = async () => {
  if (!app || Notification.permission !== "granted") return;
  try {
    const token = await getFcmToken();
    await api.post("/notifications/unregister", { token });
    await deleteToken(getMessaging(app));
  } catch (error) {
    console.error("Failed to disable push notifications:", error);
  }
};

export const sendTestNotification = () => api.post("/notifications/test");
