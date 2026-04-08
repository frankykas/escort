# Push Notifications — Setup Guide

Web Push is wired up end-to-end in the codebase. To make it *actually deliver
notifications in production*, three things need to be configured in the
hosting / Supabase dashboards — they cannot be committed to code.

---

## 1. Environment variables

Add the following to `.env.local` (dev) and your Vercel project (prod):

```bash
# Generated with `npx web-push generate-vapid-keys`
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_SUBJECT=mailto:admin@cleopatra.app

# Any long random string — this is the shared secret between
# the Supabase webhook and /api/push/send
PUSH_WEBHOOK_SECRET=<long random string>
```

The public key must be prefixed with `NEXT_PUBLIC_` so the browser can read
it when calling `pushManager.subscribe()`. The private key must **never** be
exposed to the client.

To rotate keys, regenerate and redeploy — existing `push_subscriptions` rows
will start failing with 410 and get auto-cleaned on the next send.

---

## 2. Supabase Database Webhook

Pushes are dispatched when a row lands in the `notifications` table. This is
done with a Supabase Database Webhook (Supabase dashboard → Database →
Webhooks → *Create a new hook*):

| Field | Value |
|-------|-------|
| **Name** | `push-notification-dispatch` |
| **Table** | `public.notifications` |
| **Events** | `Insert` only |
| **Type** | `HTTP Request` |
| **Method** | `POST` |
| **URL** | `https://<your-domain>/api/push/send` |
| **HTTP Headers** | `Authorization: Bearer <PUSH_WEBHOOK_SECRET>` |
| **HTTP Params** | *(none)* |

The webhook body shape Supabase sends is already handled by the route:

```json
{
  "type": "INSERT",
  "table": "notifications",
  "schema": "public",
  "record": { ... }
}
```

The `/api/push/send` route verifies the bearer token, loads the recipient's
push preferences, fetches all their registered subscriptions, and fires
encrypted push messages with `web-push`. Dead subscriptions (HTTP 404/410) are
pruned automatically.

---

## 3. Service worker

`public/sw.js` is served at the origin root and auto-registered by
`lib/push-client.ts` when the user taps **Enable** on the permission prompt.
No additional configuration is needed.

If the service worker is ever updated, bump a version comment inside `sw.js`
to force browsers to fetch the new copy (the install handler already calls
`skipWaiting`).

---

## 4. Testing end-to-end

1. Run `npm run dev`, sign in as any user.
2. Wait ~4s after landing on any page — the bottom-sheet prompt should appear.
   Click **Enable** and accept the browser permission dialog.
3. Confirm a row appeared in `push_subscriptions` for your user.
4. From another account, trigger any notification (follow them, send a
   message, like a post). Within a second or two the notification should
   appear on your OS.
5. If it doesn't:
   - Check the Supabase webhook logs for a 200 response
   - Check Vercel function logs for `/api/push/send` errors
   - In DevTools → Application → Service Workers, check that `sw.js` is
     `activated and running`
   - In DevTools → Application → Push Messaging, you can replay test pushes

---

## 5. User preferences

Per-category push toggles live on the `profiles` table:

- `push_new_messages`
- `push_new_followers`
- `push_post_activity`
- `push_bookings`
- `push_bumps`

They are checked in `lib/push-server.ts` via `shouldSendPush()` before any
send. Users can toggle them from their notification settings screen; the
webhook always fires, but sends are skipped silently when a preference is off.
