import {
  addDecoderSizePrefix,
  address,
  fetchEncodedAccounts,
  getAddressDecoder,
  getAddressEncoder,
  getProgramDerivedAddress,
  getStructDecoder,
  getU32Decoder,
  getU8Decoder,
  getUtf8Decoder,
  isSome,
  unwrapOption,
  type Account,
  type Address,
  type MaybeEncodedAccount,
} from '@solana/kit';
import type { Mint } from '@solana-program/token-2022';
import { readMint } from './mint.ts';
import { inChunks, isMain, rpc } from './rpc.ts';

export const TOKEN_METADATA_PROGRAM_ADDRESS = address('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

export type TokenInfo = {
  name: string;
  symbol: string;
  uri: string;
  source: 'token-2022 extension' | 'pointer account' | 'metaplex pda';
  account: Address;
};

// Metaplex Metadata starts with: key (u8), update authority, mint, then three
// u32-length-prefixed strings. We only need these first six fields.
// Metaplex pads name, symbol and uri with \0 bytes. Kit's getUtf8Decoder()
// strips them by default; a plain TextDecoder or Buffer.toString() does not.
const borshString = () => addDecoderSizePrefix(getUtf8Decoder(), getU32Decoder());
export const metaplexHeaderDecoder = getStructDecoder([
  ['key', getU8Decoder()],
  ['updateAuthority', getAddressDecoder()],
  ['mint', getAddressDecoder()],
  ['name', borshString()],
  ['symbol', borshString()],
  ['uri', borshString()],
]);

export async function findMetaplexPda(mint: Address): Promise<Address> {
  const enc = getAddressEncoder();
  const [pda] = await getProgramDerivedAddress({
    programAddress: TOKEN_METADATA_PROGRAM_ADDRESS,
    seeds: ['metadata', enc.encode(TOKEN_METADATA_PROGRAM_ADDRESS), enc.encode(mint)],
  });
  return pda;
}

function decodeMetaplex(account: MaybeEncodedAccount, source: TokenInfo['source']): TokenInfo | null {
  if (!account.exists || account.programAddress !== TOKEN_METADATA_PROGRAM_ADDRESS) return null;
  const { name, symbol, uri } = metaplexHeaderDecoder.decode(account.data);
  return { name, symbol, uri, source, account: account.address };
}

// Step 1 of the decision: is the metadata on the mint, and if not, where to look?
function whereIsMetadata(mint: Account<Mint>): { found: TokenInfo } | { lookAt: Address; source: TokenInfo['source'] } {
  const extensions = isSome(mint.data.extensions) ? mint.data.extensions.value : [];
  const pointer = extensions.find((e) => e.__kind === 'MetadataPointer');
  const pointsTo = pointer ? unwrapOption(pointer.metadataAddress) : null;

  if (pointsTo === mint.address) {
    const ext = extensions.find((e) => e.__kind === 'TokenMetadata');
    if (ext) {
      const { name, symbol, uri } = ext;
      return { found: { name, symbol, uri, source: 'token-2022 extension', account: mint.address } };
    }
  }
  if (pointsTo) return { lookAt: pointsTo, source: 'pointer account' };
  return { lookAt: mint.address, source: 'metaplex pda' }; // PDA derived below
}

// Works for one mint or many: one extra RPC call per 100 mints.
export async function getTokenInfos(mints: Account<Mint>[]): Promise<(TokenInfo | null)[]> {
  const plans = await Promise.all(
    mints.map(async (mint) => {
      const plan = whereIsMetadata(mint);
      if ('found' in plan) return plan;
      const lookAt = plan.source === 'metaplex pda' ? await findMetaplexPda(mint.address) : plan.lookAt;
      return { lookAt, source: plan.source };
    }),
  );

  const toFetch = plans.flatMap((p) => ('lookAt' in p ? [p.lookAt] : []));
  const fetched = await inChunks(toFetch, 100, (chunk) => fetchEncodedAccounts(rpc, chunk));
  const byAddress = new Map(fetched.map((a) => [a.address, a]));

  return plans.map((p) => ('found' in p ? p.found : decodeMetaplex(byAddress.get(p.lookAt)!, p.source)));
}

if (isMain(import.meta.url)) {
  const target = address(process.argv[2] ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  const result = await readMint(target);
  if (!result) throw new Error(`No mint at ${target}`);
  const [info] = await getTokenInfos([result.mint]);
  console.log(info ?? 'No on-chain metadata found');
}
