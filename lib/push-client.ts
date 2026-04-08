/**
 * Client-side Web Push helpers.
 *
 * These run in the browser only. Functions:
 *   - registerServiceWorker(): idempotently register /sw.js
 *   - subscribeToPush(): request permission + create a push subscription
 *   - unsubscribeFromPush(): undo the subscription on this device
 *   - getPushState(): inspect current permission / subscription status
 */

const SW_PATH = "/sw.js";

export type PushState =
  | "unsupported"    // browser doesn't support Web Push
  | "default"        // permission not yet asked
  | "granted"        // permission granted, can subscribe
  | "denied"         // user denied — can't re-ask without a manual browser reset
  | "subscribed";    // granted AND actively subscribed on this device

// ─── Service worker registration ──────────────────────────────────────────────

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  try {
    const existing = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (existing) return existing;
    return await navigator.serviceWorker.register(SW_PATH);
  } catch (err) {
    console.error("Service worker registration failed:", err);
    return null;
  }
}

// ─── Current state ────────────────────────────────────────────────────────────

export async function getPushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }

  const permission = Notification.permission;
  if (permission === "denied") return "denied";
  if (permission === "default") return "default";

  // permission === "granted" — check if we have an actual subscription
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (!reg) return "granted";
  const sub = await reg.pushManager.getSubscription();
  return sub ? "subscribed" : "granted";
}

// ─── Subscribe ────────────────────────────────────────────────────────────────

export async function subscribeToPush(userId: string): Promise<boolean> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    console.error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
    return false;
  }

  // Step 1: permission
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  // Step 2: register SW if needed
  const reg = await registerServiceWorker();
  if (!reg) return false;

  // Step 3: create subscription (or reuse existing)
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  // Step 4: POST to server
  const json = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      userAgent: navigator.userAgent,
    }),
  });

  return res.ok;
}

// ─── Unsubscribe ──────────────────────────────────────────────────────────────

export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (!reg) return true;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;

  // Tell the server first so we remove the DB row even if the browser call fails
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, endpoint: sub.endpoint }),
  });

  return sub.unsubscribe();
}

// ─── VAPID base64url → Uint8Array (required by PushManager.subscribe) ────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}
