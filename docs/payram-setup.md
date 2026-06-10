# PayRam Setup Guide

How to stand up PayRam (the crypto payment gateway powering the creator-content
layer) and wire it into Cleopatra. PayRam is **self-hosted and non-custodial** —
there is no hosted sandbox; a "sandbox" is your own server running in **testnet**
mode.

> Related: architecture & roadmap in [onlyfans-plan.md](./onlyfans-plan.md).
> Payments code: `lib/payments/`, `app/api/payments/create`, `app/api/webhooks/payram`.

---

## 1. Deploy a PayRam server

On a VPS (or locally for testing), run the one-line installer and choose
**testnet** when prompted:

```bash
bash <(curl -fsSL https://payram.com/setup_payram.sh)
```

The installer is headless and asks a few questions (testnet vs mainnet, RPC
config, SSL). It exposes the API on your host, typically port `8443`.

- **Testnet** = sandbox. Use it for all development; pay with testnet faucet
  coins (testnet USDT/ETH), no real money moves.
- **Mainnet** = production. Switch only when going live.

## 2. Create a project + API key

In the PayRam dashboard:

1. Create a **project** (API keys are scoped per project / environment).
2. Copy the project **API key** — this authenticates both our create-payment
   calls and inbound webhooks.

## 3. Configure the webhook

Set the project's **webhook URL** to:

```
https://<your-app-domain>/api/webhooks/payram
```

For local development the app runs on `http://localhost:3001`, which PayRam
can't reach. Expose it with a tunnel:

```bash
cloudflared tunnel --url http://localhost:3001
# or: ngrok http 3001
```

…then use the public tunnel URL + `/api/webhooks/payram` as the webhook.

## 4. Fill environment variables

In `.env.local` (see `.env.example`):

```
PAYRAM_API_URL=https://your-payram-host:8443     # no trailing slash
PAYRAM_API_KEY=<project API key>
PAYRAM_WEBHOOK_KEY=<usually the same as PAYRAM_API_KEY>

# Turn the creator-content layer on (build-time flag — rebuild after changing)
NEXT_PUBLIC_USE_CREATOR_CONTENT=true
```

## 5. Run the database migrations

In the Supabase SQL editor, run in order:

- `071_creator_content_foundation.sql` — private media bucket, content ratings
- `072_payram_payments.sql` — payments table, balances, confirm RPC
- `073_creator_monetization.sql` — tips, payouts, paid DMs (M3)

## 6. Test the round-trip

1. With the flag on, trigger a payment (Subscribe / Unlock / Tip) → you'll be
   redirected to a PayRam checkout `url`.
2. Pay with a **testnet faucet**.
3. PayRam fires the webhook → `confirm_payram_payment` activates the
   subscription / records the unlock / credits the creator balance.
4. Verify rows in `payments` (`status = confirmed`) and `creator_balances`.

---

## How the contract maps to our code

**Create payment** — `POST {PAYRAM_API_URL}/api/v1/payment`
| | |
|---|---|
| Headers | `API-Key`, `Content-Type: application/json` |
| Body | `{ customerEmail, customerID, amountInUSD }` |
| Response | `{ host, reference_id, url }` |

We store `reference_id` on `payments.provider_ref`; that's how the webhook maps
a confirmation back to our intent (the create call has no metadata field).

**Webhook** — PayRam → `POST /api/webhooks/payram`
| | |
|---|---|
| Payload | `{ customer_id, invoice_id, reference_id, status, amount, currency, filled_amount, filled_amount_in_usd, timestamp }` |
| Auth | `API-Key` header (verified constant-time in `verifyPayramWebhookKey`) |
| Action | confirmed status → idempotent `confirm_payram_payment` RPC |

## Gotchas / follow-ups

- **Currency:** PayRam bills in **USD** (`amountInUSD`). Our tiers display CA$;
  minor units are currently treated as USD cents. Add FX conversion before
  launch.
- **Webhook signature:** docs specify API-Key-header verification (implemented).
  If your deployed instance sends an **HMAC-SHA256** signature header instead,
  extend `verifyPayramWebhookKey` in `lib/payments/payram.ts` (seam is marked).
- **Idempotency:** `payments.provider_ref` is `UNIQUE` and `confirm_payram_payment`
  is row-locked + no-ops on already-confirmed rows. Safe under webhook retries.
- **Payouts:** PayRam is collection-side. Creator payouts draw from
  `creator_balances.available` (funds mature from `pending` after a hold window)
  and are settled via your chosen payout rail — see M3 / `app/api/payouts`.
- **Amounts are server-authoritative:** never trust a price from the client; the
  create route recomputes from the DB (tips are validated against bounds).
