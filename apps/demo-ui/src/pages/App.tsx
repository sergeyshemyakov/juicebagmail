import {
  type ReactNode,
  useDeferredValue,
  useState,
} from "react";

import {
  ALGORAND_EXPLORER_BASE_URL,
  ROUTE_PRICES,
} from "@juicebag-mail/shared";
import type {
  AgentRegistrationInput,
  AgentState,
  AgentSendLetterInput,
  ServiceState,
} from "@juicebag-mail/shared";

import { api } from "../api/client";
import { useAgentEvents } from "../hooks/useAgentEvents";
import { usePollingResource } from "../hooks/usePollingResource";

const initialRegistration: AgentRegistrationInput = {
  agentName: "Acme Filing Agent",
  entityType: "company",
  legalIdentity: {
    name: "Acme GmbH",
    street1: "Musterstrasse 1",
    postalCode: "10115",
    city: "Berlin",
    country: "DE",
  },
};

const initialLetter: AgentSendLetterInput = {
  recipient: {
    name: "Finanzamt Berlin",
    street1: "Finanzstrasse 5",
    postalCode: "10117",
    city: "Berlin",
    country: "DE",
  },
  subject: "Request for clarification",
  bodyMarkdown:
    "Dear Finanzamt,\n\nPlease share the status of our filing.\n\nBest regards,\nAcme Filing Agent",
};

export function App() {
  const agent = usePollingResource(api.getAgentState, 4_000);
  const service = usePollingResource(api.getServiceState, 4_000);
  const liveAgentEvent = useAgentEvents();

  const [registrationForm, setRegistrationForm] =
    useState<AgentRegistrationInput>(initialRegistration);
  const [letterForm, setLetterForm] = useState<AgentSendLetterInput>(initialLetter);
  const [inboundForm, setInboundForm] = useState({
    mailboxId: "",
    fromName: "Finanzamt Berlin",
    pageCount: 2,
    envelopeSummary: "Tax authority letter",
    ocrText:
      "Sehr geehrte Damen und Herren,\n\nwir bitten um eine kurze Rückmeldung.\n",
    scanFileName: "scan.pdf",
  });
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const deferredInbound = useDeferredValue(agent.data?.inboundLetters ?? []);
  const deferredOutbound = useDeferredValue(agent.data?.outboundLetters ?? []);
  const deferredServiceInbound = useDeferredValue(service.data?.inboundLetters ?? []);
  const deferredServiceOutbound = useDeferredValue(service.data?.outboundLetters ?? []);

  const defaultMailboxId =
    agent.data?.registration?.mailboxId ?? service.data?.agents[0]?.mailboxId ?? "";

  async function runAction(actionKey: string, task: () => Promise<unknown>) {
    setBusyAction(actionKey);
    try {
      await task();
      await Promise.all([agent.refresh(), service.refresh()]);
    } finally {
      setBusyAction(null);
    }
  }

  const currentAgentEvent = liveAgentEvent ?? (agent.data?.lastEvent ? {
    id: "snapshot",
    ...agent.data.lastEvent,
  } : null);

  const currentServiceEvent = service.data?.lastEvent ?? null;

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Algorand x402 Hackathon Demo</p>
          <h1>Juicebag Mail</h1>
          <p className="hero-copy">
            Physical mail, agentic commerce, and paid unlocks in one observable loop.
          </p>
        </div>
        <div className="price-strip">
          <PricePill label="Register" value={ROUTE_PRICES.registration} />
          <PricePill label="Send letter" value={ROUTE_PRICES.outboundLetter} />
          <PricePill label="Unlock OCR" value={ROUTE_PRICES.inboundUnlock} />
        </div>
      </header>

      <main className="pane-grid">
        <section className="pane pane-agent">
          <PaneHeader
            title="Agent Console"
            subtitle="Wallet, mailbox identity, inbox, and x402 outcomes."
          />

          <div className="summary-grid">
            <MetricCard label="ALGO" value={agent.data?.balances.algo?.toFixed(3) ?? "--"} />
            <MetricCard label="USDC" value={agent.data?.balances.usdc?.toFixed(3) ?? "--"} />
            <MetricCard
              label="Mailbox"
              value={agent.data?.registration?.mailboxId ?? "Not registered"}
            />
          </div>

          <Card title="Identity">
            {agent.data?.registration ? (
              <div className="identity-card">
                <p>{agent.data.registration.agentName}</p>
                <p>{agent.data.registration.legalIdentity.name}</p>
                <p>{agent.data.registration.legalIdentity.street1}</p>
                <p>
                  {agent.data.registration.legalIdentity.postalCode}{" "}
                  {agent.data.registration.legalIdentity.city}
                </p>
                <p>{agent.data.registration.legalIdentity.country}</p>
              </div>
            ) : (
              <form
                className="stack-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runAction("register", () => api.registerAgent(registrationForm));
                }}
              >
                <LabeledInput
                  label="Agent Name"
                  value={registrationForm.agentName}
                  onChange={(value) =>
                    setRegistrationForm((current) => ({ ...current, agentName: value }))
                  }
                />
                <LabeledInput
                  label="Legal Name"
                  value={registrationForm.legalIdentity.name}
                  onChange={(value) =>
                    setRegistrationForm((current) => ({
                      ...current,
                      legalIdentity: { ...current.legalIdentity, name: value },
                    }))
                  }
                />
                <LabeledInput
                  label="Street"
                  value={registrationForm.legalIdentity.street1}
                  onChange={(value) =>
                    setRegistrationForm((current) => ({
                      ...current,
                      legalIdentity: { ...current.legalIdentity, street1: value },
                    }))
                  }
                />
                <div className="split-fields">
                  <LabeledInput
                    label="Postal Code"
                    value={registrationForm.legalIdentity.postalCode}
                    onChange={(value) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        legalIdentity: { ...current.legalIdentity, postalCode: value },
                      }))
                    }
                  />
                  <LabeledInput
                    label="City"
                    value={registrationForm.legalIdentity.city}
                    onChange={(value) =>
                      setRegistrationForm((current) => ({
                        ...current,
                        legalIdentity: { ...current.legalIdentity, city: value },
                      }))
                    }
                  />
                </div>
                <ActionButton
                  label={busyAction === "register" ? "Registering..." : "Register Mailbox"}
                  disabled={busyAction !== null}
                />
              </form>
            )}
          </Card>

          <Card title="Send Letter">
            <form
              className="stack-form"
              onSubmit={(event) => {
                event.preventDefault();
                void runAction("send-letter", () => api.sendLetter(letterForm));
              }}
            >
              <LabeledInput
                label="Recipient"
                value={letterForm.recipient.name}
                onChange={(value) =>
                  setLetterForm((current) => ({
                    ...current,
                    recipient: { ...current.recipient, name: value },
                  }))
                }
              />
              <LabeledInput
                label="Street"
                value={letterForm.recipient.street1}
                onChange={(value) =>
                  setLetterForm((current) => ({
                    ...current,
                    recipient: { ...current.recipient, street1: value },
                  }))
                }
              />
              <LabeledInput
                label="Subject"
                value={letterForm.subject}
                onChange={(value) =>
                  setLetterForm((current) => ({ ...current, subject: value }))
                }
              />
              <label className="field">
                <span>Body</span>
                <textarea
                  rows={5}
                  value={letterForm.bodyMarkdown}
                  onChange={(event) =>
                    setLetterForm((current) => ({
                      ...current,
                      bodyMarkdown: event.target.value,
                    }))
                  }
                />
              </label>
              <ActionButton
                label={busyAction === "send-letter" ? "Sending..." : "Pay and Queue Letter"}
                disabled={busyAction !== null || !agent.data?.registration}
              />
            </form>
          </Card>

          <Card title="Inbound Mail">
            <Table
              columns={["From", "Status", "Received", "Action"]}
              rows={deferredInbound.map((letter: AgentState["inboundLetters"][number]) => ({
                key: letter.id,
                cells: [
                  <div>
                    <strong>{letter.fromName}</strong>
                    <small>{letter.envelopeSummary}</small>
                  </div>,
                  <StatusBadge status={letter.agentStatus} />,
                  new Date(letter.receivedAt).toLocaleString(),
                  <div className="row-actions">
                    <button
                      className="ghost-button"
                      disabled={busyAction !== null || letter.agentStatus !== "pending"}
                      onClick={() =>
                        void runAction(`unlock-${letter.id}`, () =>
                          api.unlockLetter(letter.id),
                        )
                      }
                    >
                      Unlock
                    </button>
                    <button
                      className="ghost-button"
                      disabled={busyAction !== null || letter.agentStatus !== "pending"}
                      onClick={() =>
                        void runAction(`ignore-${letter.id}`, () =>
                          api.ignoreLetter(letter.id),
                        )
                      }
                    >
                      Ignore
                    </button>
                  </div>,
                ],
              }))}
              emptyMessage="No inbound letters yet."
            />
          </Card>

          <Card title="Outbound Mail">
            <Table
              columns={["Subject", "Status", "Created", "Txid"]}
              rows={deferredOutbound.map((letter: AgentState["outboundLetters"][number]) => ({
                key: letter.id,
                cells: [
                  <div>
                    <strong>{letter.subject}</strong>
                    <small>{letter.recipient.name}</small>
                  </div>,
                  <StatusBadge status={letter.status} />,
                  new Date(letter.createdAt).toLocaleString(),
                  <TxLink txid={letter.paymentTxid ?? undefined} />,
                ],
              }))}
              emptyMessage="No outbound letters yet."
            />
          </Card>

          <EventCard
            title="Latest Agent x402 Event"
            message={currentAgentEvent?.message ?? "Waiting for the first agent event."}
            txid={currentAgentEvent && "txid" in currentAgentEvent ? currentAgentEvent.txid : undefined}
          />
        </section>

        <section className="pane pane-ops">
          <PaneHeader
            title="Juicebag Ops Console"
            subtitle="Registered mailboxes, inbound ingestion, and operator-only state."
          />

          <div className="summary-grid">
            <MetricCard
              label="Registered"
              value={String(service.data?.counters.registeredAgents ?? 0)}
            />
            <MetricCard
              label="Pending Inbound"
              value={String(service.data?.counters.pendingInboundLetters ?? 0)}
            />
            <MetricCard
              label="Queued Outbound"
              value={String(service.data?.counters.queuedOutboundLetters ?? 0)}
            />
          </div>

          <Card title="Ingest Inbound Letter">
            <form
              className="stack-form"
              onSubmit={(event) => {
                event.preventDefault();
                void runAction("ingest", () =>
                  api.ingestInboundLetter({
                    ...inboundForm,
                    mailboxId: inboundForm.mailboxId || defaultMailboxId,
                  }),
                );
              }}
            >
              <LabeledInput
                label="Mailbox Id"
                value={inboundForm.mailboxId || defaultMailboxId}
                onChange={(value) =>
                  setInboundForm((current) => ({ ...current, mailboxId: value }))
                }
              />
              <LabeledInput
                label="From"
                value={inboundForm.fromName}
                onChange={(value) =>
                  setInboundForm((current) => ({ ...current, fromName: value }))
                }
              />
              <div className="split-fields">
                <LabeledInput
                  label="Pages"
                  type="number"
                  value={String(inboundForm.pageCount)}
                  onChange={(value) =>
                    setInboundForm((current) => ({
                      ...current,
                      pageCount: Number(value),
                    }))
                  }
                />
                <LabeledInput
                  label="Scan File"
                  value={inboundForm.scanFileName}
                  onChange={(value) =>
                    setInboundForm((current) => ({ ...current, scanFileName: value }))
                  }
                />
              </div>
              <LabeledInput
                label="Envelope Summary"
                value={inboundForm.envelopeSummary}
                onChange={(value) =>
                  setInboundForm((current) => ({
                    ...current,
                    envelopeSummary: value,
                  }))
                }
              />
              <label className="field">
                <span>OCR Text</span>
                <textarea
                  rows={5}
                  value={inboundForm.ocrText}
                  onChange={(event) =>
                    setInboundForm((current) => ({
                      ...current,
                      ocrText: event.target.value,
                    }))
                  }
                />
              </label>
              <ActionButton
                label={busyAction === "ingest" ? "Ingesting..." : "Ingest Mail"}
                disabled={busyAction !== null || !defaultMailboxId}
              />
            </form>
          </Card>

          <Card title="Registered Agents">
            <Table
              columns={["Agent", "Mailbox", "Webhook"]}
              rows={(service.data?.agents ?? []).map((row: ServiceState["agents"][number]) => ({
                key: row.id,
                cells: [row.displayName, row.mailboxId, row.webhookUrl],
              }))}
              emptyMessage="No registered agents yet."
            />
          </Card>

          <Card title="Inbound Queue">
            <Table
              columns={["From", "Status", "Received", "Txid"]}
              rows={deferredServiceInbound.map((letter: ServiceState["inboundLetters"][number]) => ({
                key: letter.id,
                cells: [
                  <div>
                    <strong>{letter.fromName}</strong>
                    <small>{letter.envelopeSummary}</small>
                  </div>,
                  <StatusBadge status={letter.status} />,
                  new Date(letter.receivedAt).toLocaleString(),
                  <TxLink txid={letter.unlockPaymentTxid ?? undefined} />,
                ],
              }))}
              emptyMessage="No inbound letters yet."
            />
          </Card>

          <Card title="Outbound Queue">
            <Table
              columns={["Subject", "Status", "Created", "Action"]}
              rows={deferredServiceOutbound.map((letter: ServiceState["outboundLetters"][number]) => ({
                key: letter.id,
                cells: [
                  <div>
                    <strong>{letter.subject}</strong>
                    <small>{letter.recipient.name}</small>
                  </div>,
                  <StatusBadge status={letter.status} />,
                  new Date(letter.createdAt).toLocaleString(),
                  <button
                    className="ghost-button"
                    disabled={busyAction !== null || letter.status !== "queued"}
                    onClick={() =>
                      void runAction(`mark-${letter.id}`, () =>
                        api.markOutboundSent(letter.id),
                      )
                    }
                  >
                    Mark Sent
                  </button>,
                ],
              }))}
              emptyMessage="No outbound letters yet."
            />
          </Card>

          <EventCard
            title="Latest Ops x402 Event"
            message={currentServiceEvent?.message ?? "Waiting for the first service event."}
            txid={currentServiceEvent?.txid}
          />
        </section>
      </main>

      {(agent.error || service.error) && (
        <footer className="error-strip">
          {agent.error && <span>Agent: {agent.error}</span>}
          {service.error && <span>Service: {service.error}</span>}
        </footer>
      )}
    </div>
  );
}

function PaneHeader(props: { title: string; subtitle: string }) {
  return (
    <div className="pane-header">
      <h2>{props.title}</h2>
      <p>{props.subtitle}</p>
    </div>
  );
}

function PricePill(props: { label: string; value: string }) {
  return (
    <div className="price-pill">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function MetricCard(props: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function Card(props: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <div className="card-header">
        <h3>{props.title}</h3>
      </div>
      {props.children}
    </section>
  );
}

function EventCard(props: { title: string; message: string; txid?: string }) {
  return (
    <Card title={props.title}>
      <div className="event-card">
        <p>{props.message}</p>
        <TxLink txid={props.txid} />
      </div>
    </Card>
  );
}

function LabeledInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function ActionButton(props: { label: string; disabled?: boolean }) {
  return (
    <button className="action-button" disabled={props.disabled} type="submit">
      {props.label}
    </button>
  );
}

function StatusBadge(props: { status: string }) {
  return <span className={`status-badge status-${props.status}`}>{props.status}</span>;
}

function TxLink(props: { txid?: string }) {
  if (!props.txid) {
    return <span className="muted">No txid yet</span>;
  }

  return (
    <a
      className="tx-link"
      href={`${ALGORAND_EXPLORER_BASE_URL}${props.txid}`}
      rel="noreferrer"
      target="_blank"
    >
      {props.txid.slice(0, 10)}...
    </a>
  );
}

function Table(props: {
  columns: string[];
  rows: Array<{ key: string; cells: ReactNode[] }>;
  emptyMessage: string;
}) {
  if (props.rows.length === 0) {
    return <p className="muted">{props.emptyMessage}</p>;
  }

  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            {props.columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, index) => (
                <td key={`${row.key}-${index}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
