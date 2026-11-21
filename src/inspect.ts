import { address, fetchEncodedAccount, unwrapOption, type Account, type Address, type EncodedAccount } from '@solana/kit';
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { TOKEN_2022_PROGRAM_ADDRESS, decodeMint, fetchAllMaybeMint, type Mint } from '@solana-program/token-2022';
import { getHoldings } from './balances.ts';
import { describeExtensions } from './extensions.ts';
import { getTokenInfos } from './metadata.ts';
import { programName } from './mint.ts';
import { formatAmount } from './format.ts';
import { inChunks, rpc } from './rpc.ts';

// A mint is owned by a token program and is either 82 bytes (no extensions)
// or has account type 1 (Mint) at byte 165. A token account would have 2 there.
function isMintAccount(account: EncodedAccount): boolean {
  const tokenProgram =
    account.programAddress === TOKEN_PROGRAM_ADDRESS || account.programAddress === TOKEN_2022_PROGRAM_ADDRESS;
  return tokenProgram && (account.data.length === 82 || account.data[165] === 1);
}

async function inspectMint(account: EncodedAccount) {
  const mint = decodeMint(account);
  const [[info], { epoch }] = await Promise.all([getTokenInfos([mint]), rpc.getEpochInfo().send()]);
  const { mintAuthority, freezeAuthority, supply, decimals } = mint.data;
  return {
    type: 'mint',
    address: mint.address,
    program: programName(mint.programAddress),
    name: info?.name ?? null,
    symbol: info?.symbol ?? null,
    metadataSource: info?.source ?? 'none found',
    supply: formatAmount(supply, decimals),
    decimals,
    mintAuthority: unwrapOption(mintAuthority), // null means revoked
    freezeAuthority: unwrapOption(freezeAuthority),
    extensions: await describeExtensions(mint.address, mint.data, epoch),
  };
}

async function inspectWallet(owner: Address) {
  const holdings = await getHoldings(owner);
  // Batch reads: one getMultipleAccounts call per 100 mints, then the same for metadata.
  const uniqueMints = [...new Set(holdings.map((h) => h.mint))];
  const maybeMints = await inChunks(uniqueMints, 100, (chunk) => fetchAllMaybeMint(rpc, chunk));
  const mints = maybeMints.filter((m): m is Account<Mint> & { exists: true } => m.exists);
  const infos = await getTokenInfos(mints);
  const nameOf = new Map(mints.map((m, i) => [m.address, infos[i]]));

  return {
    type: 'wallet',
    address: owner,
    tokens: holdings.map((h) => ({
      mint: h.mint,
      program: h.program,
      symbol: nameOf.get(h.mint)?.symbol ?? null,
      amount: h.uiAmountString,
      rawAmount: h.amount,
      state: h.state,
    })),
  };
}

// JSON.stringify throws on bigint. Turn every bigint into a string.
const bigintReplacer = (_key: string, value: unknown) => (typeof value === 'bigint' ? value.toString() : value);

const input = process.argv[2];
if (!input) {
  console.error('Usage: npx tsx src/inspect.ts <wallet or mint address>');
  process.exit(1);
}
const target = address(input);
const account = await fetchEncodedAccount(rpc, target);
const report = account.exists && isMintAccount(account) ? await inspectMint(account) : await inspectWallet(target);
console.log(JSON.stringify(report, bigintReplacer, 2));
