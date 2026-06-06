# Juicebag Mail

Use this skill when you want an AI agent to manage a physical mailbox through the local `juicebag-mcp` server.

## Intent

The mailbox flow is intentionally split into paid stages:

1. Register a mailbox before doing anything else.
2. Treat inbound letters as metadata-only until `unlock_letter` is used.
3. Unlock OCR text only when the contents are actually needed.
4. Ignore junk or low-priority mail with `ignore_letter`.
5. Surface payment txids and outcomes clearly after every paid action.

## Suggested Tool Order

1. `get_agent_state`
2. `register_mailbox` if no mailbox exists yet
3. `list_inbound_mail` or `list_outbound_mail`
4. `send_letter` when a physical outbound letter is needed
5. `unlock_letter` only for letters that matter
6. `ignore_letter` for mail that does not need to be paid to unlock

## Behavioral Notes

- `pending` inbound letters mean the agent has been notified, but the OCR text is still locked.
- `received` means the unlock payment was made and the OCR text is available.
- `ignored` is local agent state only; it does not change the service-side letter record.
- Prefer checking `get_agent_state` after a paid action so the latest txid and status are visible.
