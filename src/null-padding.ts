import { address, fetchEncodedAccount, getU32Decoder, getUtf8Decoder, addDecoderSizePrefix } from '@solana/kit';
import { findMetaplexPda } from './metadata.ts';
import { rpc } from './rpc.ts';

// The name field starts at byte 65: 1 (key) + 32 (update authority) + 32 (mint).
const mint = address(process.argv[2] ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const account = await fetchEncodedAccount(rpc, await findMetaplexPda(mint));
if (!account.exists) throw new Error('No Metaplex metadata for this mint');

const raw = addDecoderSizePrefix(getUtf8Decoder({ removeNullCharacters: false }), getU32Decoder());
const kitDefault = addDecoderSizePrefix(getUtf8Decoder(), getU32Decoder());

console.log(JSON.stringify(raw.decode(account.data, 65)));
console.log(JSON.stringify(kitDefault.decode(account.data, 65)));
