export const ROUTE_PRICES = {
  registration: "$1.00",
  outboundLetter: "$0.05",
  inboundUnlock: "$0.20",
} as const;

export const ROUTE_KEYS = {
  registration: "registration",
  outboundLetter: "outbound_letter",
  inboundUnlock: "inbound_unlock",
} as const;

export const SERVICE_PORT = 4021;
export const AGENT_PORT = 4022;
export const UI_PORT = 5173;

export const ALGOD_TESTNET_URL = "https://testnet-api.algonode.cloud";
export const ALGORAND_EXPLORER_BASE_URL = "https://testnet.explorer.perawallet.app/tx/";
