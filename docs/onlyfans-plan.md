# Creator Content Platform — Implementation Plan

Premium creator-content layer ("OnlyFans-style") for Cleopatra: subscriptions,
pay-per-view (PPV) posts and DMs, tips, live shows, and creator payouts — built
on the existing feed/profile/chat/credit infrastructure.

Payments rail: **Payram** (crypto gateway, webhook-confirmed) behind a
provider-agnostic interface. Content model: **tiered** SFW / suggestive /
explicit with age-gating on adult tiers.

---

## What already exists (reuse — do not rebuild)

Migration `008_subscriptions.sql` and the existing feed/chat code already provide
most of the structural primitives:

| Primitive | Where |
|-----------|-------|
| Creator tiers | `subscription_tiers` table, edited via `app/profile/subscription/page.tsx` |
| Subscriber records | `subscriptions` (status active/cancelled/expired/past_due, `current_period_end`) |
| PPV unlocks | `content_unlocks` (`user_id`, `content_id`, `content_type` post/listing, `amount_paid`) |
| Premium post flags | `status_updates.is_premium`, `status_updates.unlock_price` |
| Subscriber count | `profiles.subscribers_count` + `update_subscribers_count()` trigger |
| Content posts | `status_updates` via `lib/posts.ts` |
| DMs | `chat_messages` / `chat_channels` via `lib/chat.ts` |
| Credit ledger pattern | `posting_package_purchases` via `lib/packages.ts` |
| Live (data-only) | LiveKit, `lib/livekit.ts` (`canPublish:false`) |
| Age / ID verification | Yoti, `lib/yoti.ts`; `profiles.yoti_age_verified`, `age_verification_status` |

**Premium encoding (reused, not replaced):**
- `is_premium = false` → public post
- `is_premium = true`, `unlock_price IS NULL` → subscribers-only
- `is_premium = true`, `unlock_price NOT NULL` → PPV (unlock via `content_unlocks`)

## Gaps this plan fills

- Media is currently a **public** URL (`status-updates` bucket) → must move premium
  media to a **private** bucket served via short-TTL signed URLs.
- No payment rail wired (Stripe stub only; Stripe disallows adult content).
- No creator payout ledger.
- No per-content rating / age gate.
- No 2257 / consent / moderation records for explicit UGC.

---

## Phase 0 / M1 — Foundations (no user-facing change)

1. **Feature flag** `USE_CREATOR_CONTENT` in `lib/features.ts` (+ CLAUDE.md table).
2. **Migration 071**:
   - `status_updates.content_rating` (`sfw` | `suggestive` | `explicit`, default `sfw`).
   - `status_updates.media_path` — private storage key (premium media).
   - `profiles.adult_content_opt_in` (consumer age-gate opt-in; used in Phase 4).
   - Private `premium-content` storage bucket + owner-only RLS (no public read).
3. **`lib/access.ts`** — entitlement core: `hasActiveSubscription`,
   `hasUnlockedPost`, `canAccessPost`. The single server-side chokepoint.
4. **`app/api/media/[postId]/route.ts`** — authenticates viewer → `canAccessPost`
   → mints a ~60s signed URL and redirects, else 403.

## Phase 2 / M2 — Payram + subscriptions (smallest revenue loop)

- `lib/payments/index.ts` provider-agnostic interface; `lib/payments/payram.ts`
  implementation; keep Stripe for non-adult flows (bumps/packages).
- `payments` table = source of truth for every transaction (pending→confirmed).
- `app/api/payments/create/route.ts` — validates amount server-side, returns
  Payram checkout URL.
- `app/api/webhooks/payram/route.ts` — **idempotent** (unique on provider ref):
  on confirmed payment, activate `subscriptions`, set `current_period_end`,
  credit `creator_balances.pending`, insert notification.

### Payram integration (real contract — docs.payram.com)

Payram is **self-hosted & non-custodial**: there is no hosted sandbox. A
"sandbox" is your own server deployed in **testnet** mode:

```bash
bash <(curl -fsSL https://payram.com/setup_payram.sh)   # choose testnet
```

Then create a project in the Payram dashboard, copy the **API key**, set the
**webhook URL** to `{APP_URL}/api/webhooks/payram`, and fill `.env.local`:
`PAYRAM_API_URL`, `PAYRAM_API_KEY`, `PAYRAM_WEBHOOK_KEY`.

- **Create payment:** `POST {PAYRAM_API_URL}/api/v1/payment`
  headers `API-Key`, `Content-Type: application/json`;
  body `{ customerEmail, customerID, amountInUSD }`;
  response `{ host, reference_id, url }`.
- **Webhook payload:** `{ customer_id, invoice_id, reference_id, status, amount,
  currency, filled_amount, filled_amount_in_usd, timestamp }`, verified via the
  `API-Key` header. (If your instance signs with HMAC-SHA256, extend
  `verifyPayramWebhookKey` in `lib/payments/payram.ts` — the seam is marked.)
- **Mapping:** create call has no metadata field, so we store Payram's
  `reference_id` on our `payments.provider_ref` and map confirmations back via
  the idempotent `confirm_payram_payment` RPC.

**Known follow-ups:** `amountInUSD` is USD while tiers display CA$ — minor units
are treated as USD cents for now; add FX before launch. Payouts to creators use
a separate rail (Payram is collection-side / non-custodial sweeps).

## Phase 3 / M3 — PPV, paid DMs, tips, payouts  ✅ backend + core UI done

Delivered (migration `073_creator_monetization.sql`, `lib/creator.ts`,
`app/api/payouts`, `components/creator/`, `app/profile/earnings`):

- PPV posts reuse `content_unlocks`; paid DMs via `chat_messages.is_locked`/
  `unlock_price` + `content_unlocks` (`content_type='message'`).
- `tips` + `payouts` tables; `creator_balances` credited on confirm; funds
  mature `pending`→`available` after a hold window (`mature_creator_balances`).
- `request_payout` RPC (atomic, draws from available); `/api/payouts` GET/POST.
- `PayButton` (subscription/ppv/message) + `TipSheet` (variable tip) components;
  Earnings dashboard at `/profile/earnings`.

**M3 UI wiring — done:**
- Paid subscribe via PayRam on `app/u/[username]/ProfileActions.tsx` (shows
  `CA$X/mo`; falls back to free subscribe when the flag is off). Also fixed a
  pre-existing bug: the subscription-state check queried `is_active` (nonexistent
  on `subscriptions`) instead of `status`.
- `TipSheet` trigger ("Send a tip") on creator profiles.
- Cancel-subscription on `/profile/subscriptions` (sets `status='cancelled'`;
  `hasActiveSubscription` now grants access until `current_period_end`).
- Earnings entry in the profile provider menu → `/profile/earnings`.

## Phase 3b / M3b — PPV posts in the feed  ✅ done

- `get_feed_posts` (migration `074_feed_premium_fields.sql`) now returns
  `is_premium`/`unlock_price`/`content_rating`/`media_path`, and emits NULL for a
  premium post's `media_url` (private media never gets a public URL).
- `FeedList` hydrates the viewer's entitlement client-side (active/cancelled
  subscriptions + `content_unlocks`) and passes `isUnlocked` per post.
- `FeedPost` renders a blurred **locked card** with `PayButton` (purpose `ppv`)
  or a "Subscribe to view" link; unlocked premium media loads via
  `/api/media/[postId]` (signed URL), re-checked server-side.
- Composer (`CreateStatusDrawer`) gained visibility (public/subscribers/ppv) +
  price + content-rating controls; `useUploadStatus` uploads premium media to the
  **private** `premium-content` bucket and sets `media_path`/`is_premium`/etc.

## Phase 3c / M3c — Paid DMs  ✅ done

Secure across all three gating surfaces (migration `077_paid_dm_storage.sql`):
1. **History API** (`/api/chat/messages` GET) strips media + private paths for
   locked messages unless the viewer is the sender or has a `content_unlocks`
   row (`content_type='message'`); returns `is_locked`/`unlock_price`/`unlocked`.
2. **Realtime** (`ChatContext.sendLockedAttachment`) uploads to the private
   `premium-content` bucket and broadcasts only a **locked placeholder** over the
   LiveKit data channel — never the media.
3. **Signed-URL route** `/api/chat/attachment/[messageId]` mints a 60s URL only
   for the sender or a paid unlocker who is a channel member.

UI: creators arm a lock + price next to the attachment button; recipients see a
locked bubble with `PayButton` (purpose `message`) and the photo reveals after
payment (on return to the thread). Unlock revenue flows through the existing
`message` payment purpose + `confirm_payram_payment`.

**Note:** unlock reveal happens on thread re-entry (history refetch), not via a
realtime push — acceptable since the buyer returns from the Payram checkout.

**Ops:** schedule `select mature_creator_balances();` (e.g. hourly via
Supabase cron / edge function). Default hold = 7 days, override via
`platform_settings.payout_hold_days`.

## Phase 4 / M4 — Tiered explicit/SFW, age gate & compliance  ✅ done

Migration `075_content_compliance.sql` + enforcement across feed, media, composer, admin.

- **Age gate (two layers):**
  - `get_feed_posts` gains `p_allow_adult`: when false, only SFW posts return.
    `/api/feed` computes it from the authed viewer via `isAdultEligible`
    (`yoti_age_verified` AND `adult_content_opt_in`). Anonymous + SSR = SFW only.
  - `/api/media/[postId]` re-checks adult eligibility for suggestive/explicit
    media (creator exempt), so a direct route hit can't bypass the feed filter.
- **Consumer opt-in:** toggle in `/profile/privacy`, blocked unless age-verified.
- **Creator gate:** the composer blocks explicit selection unless the creator is
  `yoti_age_verified`, and requires a consent attestation checkbox.
- **Moderation:** explicit posts insert with `moderation_status='pending'` + a
  `content_compliance` record (2257-style), and stay hidden from the feed until
  an admin approves them at `/admin/moderation` (`reviewExplicitContent`).

**M4 follow-ups (before scale / strict jurisdictions):**
- Per-content **performer IDs + consent doc upload** (schema has `performer_ids`
  + `consent_doc_path`; UI not built — currently uploader self-attestation only).
- **CSAM/illegal scanning** hook on upload + takedown flow.
- **Geo SFW-only** enforcement in strict regions (force `p_allow_adult=false`).
- Suggestive content currently skips the moderation queue (only explicit is
  queued) — revisit per policy.

## Phase 6 / M5 — Differentiators

**Ticketed live shows ✅ done** (migration `078_live_streams.sql`, `USE_LIVE_SHOWS`):
- `live_streams` table; tickets reuse `content_unlocks` (`content_type='stream'`)
  + payments purpose `stream`; `confirm_payram_payment` grants the ticket.
- LiveKit A/V: `createStreamToken` (host publishes, viewers subscribe); token
  route `/api/streams/[id]/token` gates on host-or-ticket.
- Routes: `/live` (discovery), `/live/new` (host), `/live/[id]` (broadcaster /
  ticket gate / viewer + in-stream tipping via `TipSheet`). `LiveRoom` component
  wraps the LiveKit client.

**Platform bundle packages ✅ done** (migration `079_bundles.sql`):
- `bundles` + `bundle_subscriptions`; payment purpose `bundle`; confirm RPC
  grants/extends an all-access pass. `canAccessPost` + `FeedList` treat an active
  bundle as unlocking every creator's subscriber-only content.
- `/bundles` (consumer subscribe) + `/admin/bundles` (create/toggle).
- **Revenue is pooled** (no per-creator credit). Fair engagement-based split is a
  follow-up (needs a usage ledger + periodic distribution job).

**M5 remaining (polish, not blocking):**
- Discovery-native: surface live shows + creators on Explore.
- Live-show hardening: persist viewer counts, recording/replay, scheduled shows,
  reconnect handling.
- Bundle revenue-split distribution job.

## Compliance follow-ups  ✅ done (this pass)

- **Geo SFW-only:** `isAdultBlockedRegion` (env `ADULT_BLOCKED_COUNTRIES`) forces
  SFW in restricted countries — enforced in `/api/feed` and `/api/media`
  (`x-vercel-ip-country`). State/province-level granularity is a follow-up.
- **2257 capture:** explicit composer collects performer @usernames (→ resolved
  to ids) + an optional consent doc (private bucket); stored on
  `content_compliance` and shown in the admin review queue.
- **CSAM seam:** `lib/moderation.ts` (`scanMedia`/`quarantinePost`) +
  `/api/moderation/scan` (secret-guarded) — wire a licensed provider via
  `CSAM_SCAN_ENDPOINT`; human moderation is the safeguard until then.

---

## Money convention

All amounts are integer minor units (pence/cents), per project standard and the
existing `monthly_rate` / `unlock_price` / `amount_paid` columns.
