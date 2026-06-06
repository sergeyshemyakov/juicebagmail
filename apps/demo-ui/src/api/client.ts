import type {
  AgentRegistrationInput,
  AgentSendLetterInput,
  AgentState,
  ServiceState,
} from "@juicebag-mail/shared";

const agentApiUrl = import.meta.env.AGENT_API_URL ?? "http://localhost:4022";
const serviceApiUrl = import.meta.env.SERVICE_API_URL ?? "http://localhost:4021";
const agentUiToken =
  import.meta.env.AGENT_UI_TOKEN ?? "juicebag-agent-ui-demo-token";
const adminUiToken =
  import.meta.env.ADMIN_UI_TOKEN ?? "juicebag-admin-demo-token";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export const api = {
  agentEventsUrl() {
    const token = encodeURIComponent(agentUiToken);
    return `${agentApiUrl}/events?token=${token}`;
  },
  getAgentState() {
    return request<AgentState>(`${agentApiUrl}/state`, {
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
      },
    });
  },
  registerAgent(input: AgentRegistrationInput) {
    return request<AgentState>(`${agentApiUrl}/actions/register`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },
  sendLetter(input: AgentSendLetterInput) {
    return request<AgentState>(`${agentApiUrl}/actions/send-letter`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },
  unlockLetter(letterId: string) {
    return request<AgentState>(`${agentApiUrl}/actions/unlock-letter`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ letterId }),
    });
  },
  ignoreLetter(letterId: string) {
    return request<AgentState>(`${agentApiUrl}/actions/ignore-letter`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentUiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ letterId }),
    });
  },
  getServiceState() {
    return request<ServiceState>(`${serviceApiUrl}/internal/state`, {
      headers: {
        Authorization: `Bearer ${adminUiToken}`,
      },
    });
  },
  ingestInboundLetter(input: {
    mailboxId: string;
    fromName: string;
    pageCount: number;
    envelopeSummary: string;
    ocrText: string;
    scanFileName?: string;
  }) {
    return request<{ letterId: string }>(`${serviceApiUrl}/internal/inbound-letters`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminUiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },
  markOutboundSent(letterId: string) {
    return request<{ ok: boolean }>(
      `${serviceApiUrl}/internal/outbound-letters/${letterId}/mark-sent`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminUiToken}`,
        },
      },
    );
  },
};
