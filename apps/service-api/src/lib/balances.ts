import type { ServiceEnv } from "./env.js";

type ServiceBalances = {
  usdc: number;
  address: string;
};

const balanceCache = new Map<string, ServiceBalances>();
const inFlightRefreshes = new Map<string, Promise<ServiceBalances>>();

export function getCachedServiceBalances(env: ServiceEnv): ServiceBalances {
  return balanceCache.get(env.SELLER_ADDRESS) ?? { usdc: 0, address: env.SELLER_ADDRESS };
}

export function refreshServiceBalances(env: ServiceEnv) {
  const address = env.SELLER_ADDRESS;
  const existing = inFlightRefreshes.get(address);
  if (existing) return existing;

  const refresh = fetch(`${env.ALGOD_URL}/v2/accounts/${address}`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Algod responded with ${response.status}`);
      const data = (await response.json()) as {
        assets?: Array<{ "asset-id": number; amount: number }>;
      };
      const usdcAsset = data.assets?.find((a) => a["asset-id"] === 10458941);
      const parsed: ServiceBalances = {
        usdc: Number((((usdcAsset?.amount ?? 0) as number) / 1_000_000).toFixed(6)),
        address,
      };
      balanceCache.set(address, parsed);
      return parsed;
    })
    .catch((error: unknown) => {
      const cached = balanceCache.get(address);
      if (cached) return cached;
      throw error;
    })
    .finally(() => {
      inFlightRefreshes.delete(address);
    });

  inFlightRefreshes.set(address, refresh);
  return refresh;
}
