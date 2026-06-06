# Juicebag Mail

Use this skill when an AI agent needs to manage a physical mailbox: registering an identity, sending physical letters, or reading inbound mail through the local `juicebag-mcp` server.

## Explainer

Juicebag Mail is a physical mailbox service for autonomous agents. Agents pay with USDC on Algorand for three actions: registering a mailbox identity, sending a physical letter, and unlocking the scanned contents of an inbound letter. Payments are enforced on the server — each paid action returns a blockchain transaction ID as proof. The service notifies the agent by webhook when new mail arrives, but the OCR text is a separate paid unlock. The agent holds its own wallet and credentials; the MCP tools handle payment automatically.

## Prices

Always inform user of the price before any action that spends USDC.

| Action | Cost |
|---|---|
| Register a mailbox | $1.00 USDC |
| Send an outbound letter | $0.05 USDC |
| Unlock an inbound letter | $0.20 USDC |

## Intent

The mailbox flow is intentionally split into paid stages. This is by design — the agent is billed only for what it actually uses.

1. **Register first.** A mailbox must exist before any mail operations are possible. Registration establishes the agent's physical identity and address with Juicebag Mail.
2. **Inbound letters arrive as metadata only.** When a letter arrives, the agent is notified with basic details (sender, page count, a short summary) but the content is not included. The OCR text is unlocked separately.
3. **Unlock only when the content is needed.** Unlocking costs $0.20. If the letter is obviously junk or irrelevant, ignore it instead.
4. **Use `ignore_letter` for mail that does not need to be read.** This is a free local action — it marks the letter as ignored in the agent's own state so it stops appearing as pending.
5. **Always report payment outcomes.** After any paid action, surface the transaction ID and the new status to the user.

## Suggested Tool Order

1. `get_agent_state` — check current registration, wallet balances, and inbox before doing anything.
2. `register_mailbox` — if no mailbox exists yet, register one with the agent's legal identity and a webhook URL.
3. `list_inbound_mail` or `list_outbound_mail` — review what is in the inbox or what letters have been sent.
4. `send_letter` — when a physical outbound letter needs to be written and mailed.
5. `unlock_letter` — only for inbound letters whose content is actually needed.
6. `ignore_letter` — for letters that are not worth unlocking.

## Letter Statuses

**Inbound:**
- `pending` — the agent has been notified, but has not yet paid to unlock the OCR text.
- `received` — the unlock payment was made and the full OCR text is available.
- `ignored` — the agent chose not to unlock this letter. Local state only; the letter still exists on the service side.

**Outbound:**
- `queued` — the letter was submitted and payment was accepted; Juicebag Mail will print and mail it.
- `sent` — the operator has confirmed the letter was physically mailed.

## Behavioral Notes

- `get_agent_state` is always safe and free. Use it to orient before acting and to confirm results after a paid action.
- Do not call `unlock_letter` speculatively. Each unlock is a real payment.
- If `register_mailbox` has already been called in a previous session, `get_agent_state` will show the existing registration — skip re-registration.
- After every paid action, log or report the returned `txid` so the user can verify the payment on-chain.
