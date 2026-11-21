import { createSolanaRpc } from '@solana/kit';
import { pathToFileURL } from 'node:url';

// Public endpoint from the Solana docs. Fine for a tutorial, rate limited for real apps.
export const RPC_URL = process.env.RPC_URL ?? 'https://api.mainnet.solana.com';
export const rpc = createSolanaRpc(RPC_URL);

// getMultipleAccounts takes at most 100 addresses per call, so batch reads go in chunks.
export async function inChunks<T, R>(items: T[], size: number, fn: (chunk: T[]) => Promise<R[]>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await fn(items.slice(i, i + size))));
  return out;
}

// True when this file is the one you ran with `npx tsx`, false when it is imported.
export function isMain(moduleUrl: string): boolean {
  return process.argv[1] !== undefined && moduleUrl === pathToFileURL(process.argv[1]).href;
}

if (isMain(import.meta.url)) {
  const slot = await rpc.getSlot().send();
  const { epoch } = await rpc.getEpochInfo().send();
  console.log({ rpc: RPC_URL, slot, epoch });
}
