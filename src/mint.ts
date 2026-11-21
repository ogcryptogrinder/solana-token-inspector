import { address, unwrapOption, type Address } from '@solana/kit';
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { TOKEN_2022_PROGRAM_ADDRESS, fetchMaybeMint } from '@solana-program/token-2022';
import { formatAmount } from './format.ts';
import { isMain, rpc } from './rpc.ts';

export function programName(programAddress: Address): string {
  if (programAddress === TOKEN_PROGRAM_ADDRESS) return 'Token';
  if (programAddress === TOKEN_2022_PROGRAM_ADDRESS) return 'Token-2022';
  return `not a token program (${programAddress})`;
}

// One client decodes both kinds of mint. It does not check the owner, so we report it.
export async function readMint(mintAddress: Address) {
  const mint = await fetchMaybeMint(rpc, mintAddress);
  if (!mint.exists) return null;

  const mintAuthority = unwrapOption(mint.data.mintAuthority);
  const freezeAuthority = unwrapOption(mint.data.freezeAuthority);
  return {
    mint,
    summary: {
      address: mint.address,
      program: programName(mint.programAddress),
      supply: formatAmount(mint.data.supply, mint.data.decimals),
      decimals: mint.data.decimals,
      mintAuthority: mintAuthority ?? 'none (revoked, fixed supply)',
      freezeAuthority: freezeAuthority ?? 'none (revoked)',
    },
  };
}

if (isMain(import.meta.url)) {
  const target = address(process.argv[2] ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  const result = await readMint(target);
  console.log(result ? result.summary : `No account at ${target}`);
}
