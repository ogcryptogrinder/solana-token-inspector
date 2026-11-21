import { isMain } from './rpc.ts';

// Turn a raw u64 amount into a decimal string without ever touching floats.
export function formatAmount(raw: bigint, decimals: number): string {
  if (decimals === 0) return raw.toString();
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = (raw % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

if (isMain(import.meta.url)) {
  console.log(formatAmount(1_000_500n, 6)); // 1.0005
  console.log(formatAmount(42n, 9)); // 0.000000042
  // A big raw amount, once with BigInt math and once with float math:
  const raw = 123_456_789_012_345_678n;
  console.log(formatAmount(raw, 9)); // 123456789.012345678
  console.log(Number(raw) / 1e9); // the last digits are lost
}
