# Juicebag Mail

Algorand agentic commerce hackathon project for June 2026.

## What’s here

- `apps/service-api`: Juicebag Mail seller service with SQLite state, webhook delivery, local file storage, and three x402-paid routes.
- `apps/agent-api`: server-side buyer agent with an Algorand wallet, signed webhook handling, local inbox state, and SSE events.
- `apps/demo-ui`: two-pane React dashboard for the agent and Juicebag operator flows.
- `apps/juicebag-mcp`: thin MCP server that exposes the agent actions as native tools.
- `packages/shared`: shared schemas, statuses, pricing constants, and event types.
- `skills/juicebag-mail`: local guidance for agents using the MCP tools.

## Required env

Create a local `.env` based on `.env.example`.

Minimum important values:

- `AGENT_MNEMONIC` or `AVM_MNEMONIC`: the paying TestNet wallet mnemonic for `agent-api`
- `SELLER_ADDRESS`: the TestNet USDC-enabled address that `service-api` should receive payments on
- `WEBHOOK_SECRET_MASTER_KEY`: encryption key seed for stored webhook secrets

Optional but useful:

- `ADMIN_UI_TOKEN`
- `AGENT_UI_TOKEN`
- `SERVICE_BASE_URL`
- `AGENT_BASE_URL`
- `ALGOD_URL`
- `FACILITATOR_URL`

## Install and build

```bash
pnpm install
pnpm build
```

## Run locally

In separate terminals:

```bash
pnpm dev:service
pnpm dev:agent
pnpm dev:ui
pnpm dev:mcp
```

Default ports:

- `service-api`: `4021`
- `agent-api`: `4022`
- `demo-ui`: `5173`

## Demo flow

1. Open the UI at `http://localhost:5173`.
2. Register the agent mailbox from the left pane.
3. Send an outbound letter from the left pane.
4. Ingest an inbound letter from the right pane.
5. Unlock the OCR text from the left pane.

## Validation

The current workspace build passes with:

```bash
pnpm build
```
