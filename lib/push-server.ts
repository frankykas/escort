/**
 * Server-side Web Push sender.
 *
 * Uses the `web-push` package + VAPID keys to dispatch encrypted push
 * messages to a user's registered devices.
 *
 * This file imports `web-push` which is a node-only package — never import
 * it from client components.
 */

import webpush from "web-push";
import { createServerClient } from "@/lib/supabase/server";
import type { NotificationType } from "@/lib/notifications";

// ─── Lazy VAPID config (throw-less until first send) ─────────────────────────

let configured = false;
function configureVapid() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@cleopatra.app";
  if (!pub || !priv) {
    throw new Error("VAPID keys missing: set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY");
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

// ─── Payload types ────────────────────────────────────────────────────────────

export type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  timestamp?: number;
};

export type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType | "bump_expiring" | "bump_expired" | "comment_approved";
  title: string;
  body: string | null;
  reference_id: string | null;
  reference_type: string | null;
};

// ─── Check user preferences before sending ───────────────────────────────────

function shouldSendPush(
  type: string,
  prefs: {
    push_new_messages: boolean;
    push_new_followers: boolean;
    push_post_activity: boolean;
    push_bookings: boolean;
    push_bumps: boolean;
  }
): boolean {
  switch (type) {
    case "new_message":
    case "message_request":
    case "message_request_accepted":
      return prefs.push_new_messages;
    case "new_follower":
    case "new_subscriber":
      return prefs.push_new_followers;
    case "post_liked":
    case "post_commented":
    case "comment_approved":
      return prefs.push_post_activity;
    case "booking_requested":
    case "booking_accepted":
    case "booking_declined":
    case "booking_completed":
    case "booking_cancelled":
      return prefs.push_bookings;
    case "bump_expiring":
    case "bump_expired":
      return prefs.push_bumps;
    default:
      return true;
  }
}

// ─── Map a notification row to the URL the click should open ────────────────

function routeForNotification(n: NotificationRow, actorUsername: string | null): string {
  switch (n.type) {
    case "new_message":
    case "message_request_accepted":
      return actorUsername ? `/messages/${actorUsername}` : "/messages";
    case "message_request":
      return "/messages?tab=requests";
    case "new_follower":
    case "new_subscriber":
      return actorUsername ? `/u/${actorUsername}` : "/profile";
    case "post_liked":
    case "post_commented":
    case "comment_approved":
      return "/";
    case "booking_requested":
    case "booking_accepted":
    case "booking_declined":
    case "booking_completed":
    case "booking_cancelled":
      return "/profile/bookings";
    case "bump_expiring":
    case "bump_expired":
      return "/profile/listings";
    default:
      return "/notifications";
  }
}

// ─── Main entry point: send a push for a given notification row ─────────────

export async function sendPushForNotification(n: NotificationRow): Promise<{
  sent: number;
  failed: number;
  cleaned: number;
}> {
  configureVapid();
  const supabase = createServerClient();
  if (!supabase) return { sent: 0, failed: 0, cleaned: 0 };

  // 1. Check recipient's preferences
  const { data: recipient } = await supabase
    .from("profiles")
    .select("push_new_messages, push_new_followers, push_post_activity, push_bookings, push_bumps")
    .eq("id", n.recipient_id)
    .single();

  if (!recipient) return { sent: 0, failed: 0, cleaned: 0 };
  if (!shouldSendPush(n.type, recipient)) return { sent: 0, failed: 0, cleaned: 0 };

  // 2. Look up actor username (for routing + tag dedup)
  let actorUsername: string | null = null;
  if (n.actor_id) {
    const { data: actor } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", n.actor_id)
      .single();
    actorUsername = actor?.username ?? null;
  }

  // 3. Fetch all push subscriptions for this recipient
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", n.recipient_id);

  if (!subs || subs.length === 0) return { sent: 0, failed: 0, cleaned: 0 };

  // 4. Build payload
  const payload: PushPayload = {
    title: n.title,
    body: n.body || "",
    url: routeForNotification(n, actorUsername),
    // Tag collapses multiple notifications of the same type from the same actor
    tag: `${n.type}:${n.actor_id ?? "system"}`,
    timestamp: Date.now(),
  };
  const payloadString = JSON.stringify(payload);

  // 5. Dispatch to each subscription in parallel
  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadString
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        // 404/410 = subscription is gone; remove it from the DB
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(sub.id);
        } else {
          console.error("Push send failed:", err);
        }
      }
    })
  );

  // 6. Clean up dead subscriptions
  let cleaned = 0;
  if (staleIds.length > 0) {
    const { count } = await supabase
      .from("push_subscriptions")
      .delete({ count: "exact" })
      .in("id", staleIds);
    cleaned = count ?? 0;
  }

  // 7. Bump last_used_at on surviving subscriptions (fire-and-forget)
  if (sent > 0) {
    supabase
      .from("push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", n.recipient_id)
      .then(() => {});
  }

  return { sent, failed, cleaned };
}
