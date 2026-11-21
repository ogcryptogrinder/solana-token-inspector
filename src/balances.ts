import { address, type Address } from '@solana/kit';
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { TOKEN_2022_PROGRAM_ADDRESS } from '@solana-program/token-2022';
import { isMain, rpc } from './rpc.ts';

export type Holding = {
  tokenAccount: Address;
  mint: Address;
  program: 'Token' | 'Token-2022';
  amount: bigint; // raw units
  decimals: number;
  uiAmountString: string; // what the RPC says a wallet should show
  state: 'initialized' | 'frozen' | 'uninitialized';
};

const PROGRAMS = [
  { programId: TOKEN_PROGRAM_ADDRESS, name: 'Token' },
  { programId: TOKEN_2022_PROGRAM_ADDRESS, name: 'Token-2022' },
] as const;

// getTokenAccountsByOwner only searches one program per call, so ask both and merge.
export async function getHoldings(owner: Address): Promise<Holding[]> {
  const responses = await Promise.all(
    PROGRAMS.map(({ programId }) =>
      rpc.getTokenAccountsByOwner(owner, { programId }, { encoding: 'jsonParsed' }).send(),
    ),
  );

  return responses.flatMap((response, i) =>
    response.value.map(({ pubkey, account }) => {
      const info = account.data.parsed.info;
      return {
        tokenAccount: pubkey,
        mint: info.mint,
        program: PROGRAMS[i].name,
        amount: BigInt(info.tokenAmount.amount),
        decimals: info.tokenAmount.decimals,
        uiAmountString: info.tokenAmount.uiAmountString,
        state: info.state,
      };
    }),
  );
}

if (isMain(import.meta.url)) {
  // Default: USDC's mint authority, a public address anyone can look up on an explorer.
  const owner = address(process.argv[2] ?? 'BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG');
  const holdings = await getHoldings(owner);
  console.table(
    holdings.map(({ mint, program, uiAmountString, state }) => ({ mint, program, amount: uiAmountString, state })),
  );
}
