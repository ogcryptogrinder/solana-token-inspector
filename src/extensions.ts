import { address, isSome, unwrapOption, type Address } from '@solana/kit';
import {
  amountToUiAmountForMintWithoutSimulation,
  type Extension,
  type Mint,
  type TransferFee,
} from '@solana-program/token-2022';
import { formatAmount } from './format.ts';
import { readMint } from './mint.ts';
import { isMain, rpc } from './rpc.ts';

// olderTransferFee applies before newerTransferFee.epoch, newerTransferFee from then on.
export function feeInForce(
  ext: Extract<Extension, { __kind: 'TransferFeeConfig' }>,
  currentEpoch: bigint,
): TransferFee {
  return currentEpoch < ext.newerTransferFee.epoch ? ext.olderTransferFee : ext.newerTransferFee;
}

export async function describeExtensions(mintAddress: Address, mint: Mint, currentEpoch: bigint) {
  const extensions = isSome(mint.extensions) ? mint.extensions.value : [];
  const out: Record<string, unknown>[] = [];

  for (const ext of extensions) {
    switch (ext.__kind) {
      case 'TransferFeeConfig': {
        const fee = feeInForce(ext, currentEpoch);
        out.push({
          kind: ext.__kind,
          feeInForce: `${fee.transferFeeBasisPoints / 100}% (${fee.transferFeeBasisPoints} bps)`,
          maximumFee: formatAmount(fee.maximumFee, mint.decimals),
          feeSinceEpoch: fee.epoch,
          currentEpoch,
        });
        break;
      }
      case 'MetadataPointer': {
        const target = unwrapOption(ext.metadataAddress);
        out.push({
          kind: ext.__kind,
          metadataAddress: target,
          pointsTo: target === null ? 'nothing' : target === mintAddress ? 'the mint itself' : 'another account',
        });
        break;
      }
      case 'NonTransferable':
        out.push({ kind: ext.__kind, meaning: 'holders cannot transfer this token' });
        break;
      case 'PermanentDelegate':
        out.push({ kind: ext.__kind, delegate: ext.delegate, meaning: 'can transfer or burn from any holder' });
        break;
      case 'ScaledUiAmountConfig':
      case 'InterestBearingConfig': {
        // Display amount is NOT raw / 10^decimals here. Let the client do the math.
        const oneToken = 10n ** BigInt(mint.decimals);
        const shownAs = await amountToUiAmountForMintWithoutSimulation(rpc, mintAddress, oneToken);
        out.push({
          kind: ext.__kind,
          ...(ext.__kind === 'ScaledUiAmountConfig'
            ? {
                multiplier: ext.multiplier,
                newMultiplier: ext.newMultiplier,
                newMultiplierFrom: new Date(Number(ext.newMultiplierEffectiveTimestamp) * 1000).toISOString(),
              }
            : { currentRateBps: ext.currentRate }),
          rawAmount: oneToken,
          naiveDisplay: formatAmount(oneToken, mint.decimals),
          correctDisplay: shownAs,
        });
        break;
      }
      default:
        out.push({ kind: ext.__kind }); // the other kinds: listed by name only
    }
  }
  return out;
}

if (isMain(import.meta.url)) {
  const target = address(process.argv[2] ?? '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo');
  const [result, epochInfo] = await Promise.all([readMint(target), rpc.getEpochInfo().send()]);
  if (!result) throw new Error(`No mint at ${target}`);
  console.log(result.summary.program, target);
  console.log(await describeExtensions(target, result.mint.data, epochInfo.epoch));
}
