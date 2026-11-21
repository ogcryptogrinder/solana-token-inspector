import { address } from '@solana/kit';
import { fetchMint } from '@solana-program/token-2022';
import { rpc } from './rpc.ts';

const mint = await fetchMint(rpc, address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'));
try {
  console.log(JSON.stringify(mint.data));
} catch (error) {
  console.log(String(error)); // what you get without a replacer
}
const bigintReplacer = (_key: string, value: unknown) => (typeof value === 'bigint' ? value.toString() : value);
console.log(JSON.stringify(mint.data, bigintReplacer));
