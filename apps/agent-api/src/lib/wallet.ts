import algosdk from "algosdk";

export function mnemonicToPrivateKeyBase64(mnemonic: string) {
  const account = algosdk.mnemonicToSecretKey(mnemonic);
  return Buffer.from(account.sk).toString("base64");
}

export function mnemonicToAddress(mnemonic: string) {
  return algosdk.mnemonicToSecretKey(mnemonic).addr.toString();
}

export async function fetchBalances(address: string, algodUrl: string) {
  const response = await fetch(`${algodUrl}/v2/accounts/${address}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch account: ${response.status}`);
  }

  const data = (await response.json()) as {
    amount?: number;
    assets?: Array<{ "asset-id": number; amount: number }>;
  };

  const usdcAsset = data.assets?.find((asset) => asset["asset-id"] === 10458941);

  return {
    algo: Number(((data.amount ?? 0) / 1_000_000).toFixed(6)),
    usdc: Number((((usdcAsset?.amount ?? 0) as number) / 1_000_000).toFixed(6)),
  };
}
