# API Key V3 / HMAC Code Samples

These samples cover the new partner self-service token flow in the TypeScript SDK:

- derive scoped api tokens from a Privy identity token
- use HMAC authentication on HTTP and WebSocket requests
- create partner-owned child accounts
- place delegated orders with `onBehalfOf`
- cancel delegated orders by id and by market
- redeem resolved positions from server-managed wallets
- optionally withdraw server-wallet funds with explicit `withdrawal` scope

## Files

- `api-tokens.ts`
  Capabilities, derive token, HMAC portfolio, list tokens, optional revoke

- `partner-account.ts`
  Create partner child account with `createServerWallet=true` and optional public `displayName`

- `e2e-flow.ts`
  Simple narrated end-to-end partner flow: capabilities, derive HMAC token, create child account, funding reminder, delegated trade, cleanup

- `e2e-fok-flow.ts`
  Simple narrated end-to-end partner flow for delegated `FOK` trading: capabilities, derive HMAC token, create child account, funding reminder, delegated `FOK` BUY order, no cleanup

- `delegated-order.ts`
  Reuse or create delegated account, create delegated `GTC` order with `postOnly`, cancel by id, cancel all

- `delegated-fok-order.ts`
  Reuse or create delegated account, submit a delegated FOK BUY order, and inspect whether it matched or auto-cancelled

- `server-wallet-redeem-withdraw.ts`
  Reuse or create a server-wallet child account, redeem by `conditionId`, and optionally withdraw funds with `onBehalfOf`

- `websocket-hmac.ts`
  HMAC-authenticated websocket positions and transactions

## Environment

Use the shared [`../.env.example`](../.env.example) template.

Common values for this folder:

```bash
LIMITLESS_IDENTITY_TOKEN=
PARTNER_NAME=partner-a
MARKET_SLUG=
```

Optional example-only overrides:

```bash
# API_URL=https://dev4.api.limitless-operations.xyz
# WS_URL=wss://dev4.ws.limitless.exchange
# LIMITLESS_KEEP_DERIVED_TOKENS=1
# LIMITLESS_EXAMPLE_TRACE=1
# LIMITLESS_SKIP_WITHDRAW=1
# LIMITLESS_WITHDRAW_AMOUNT=
# LIMITLESS_WITHDRAW_DESTINATION=
# LIMITLESS_WITHDRAW_TOKEN=
```

These variables are used by the sample runners only. In real SDK usage, base URLs and auth config are passed directly to the SDK client objects.

## Running

From the SDK root:

```bash
npx tsx docs/code-samples/api-key-v3/api-tokens.ts
npx tsx docs/code-samples/api-key-v3/partner-account.ts
npx tsx docs/code-samples/api-key-v3/e2e-flow.ts
npx tsx docs/code-samples/api-key-v3/e2e-fok-flow.ts
npx tsx docs/code-samples/api-key-v3/delegated-order.ts
npx tsx docs/code-samples/api-key-v3/delegated-fok-order.ts
npx tsx docs/code-samples/api-key-v3/server-wallet-redeem-withdraw.ts
npx tsx docs/code-samples/api-key-v3/websocket-hmac.ts
```

## Notes

- The server-wallet redeem/withdraw sample is only for child accounts created with `createServerWallet=true`.
- `LIMITLESS_SKIP_WITHDRAW=1` is the safe default; set it to `0` only when you intend to move funds.
- `LIMITLESS_WITHDRAW_AMOUNT` is required when the withdraw step is enabled and must be provided in the token smallest unit.
