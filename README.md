# solana-token-inspector

A small TypeScript CLI that reads any Solana token with [`@solana/kit`](https://github.com/anza-xyz/kit). Give it one address and it works out what it is:

- **a wallet:** every token it holds, across both the Token and Token-2022 programs
- **a mint:** supply, decimals, mint authority and freeze authority, Token-2022 extensions, and metadata wherever it lives

Read only. It never signs or sends a transaction and needs no keys, no wallet and no SOL.

Step-by-step tutorial: [How to Read Any Solana Token in TypeScript with @solana/kit](https://sanketwrites.hashnode.dev/read-solana-token-typescript-kit)

## What it handles

- **Both token programs.** `getTokenAccountsByOwner` searches one program per call, so wallets are queried on Token and Token-2022 and merged.
- **Token-2022 extensions:** the transfer fee in force for the current epoch (older vs newer fee), metadata pointer, permanent delegate, non-transferable, and the display amount for Scaled UI Amount and Interest Bearing mints (where raw / 10^decimals is the wrong number).
- **Metadata both ways:** the Token-2022 TokenMetadata extension on the mint, or the Metaplex metadata account (decoded with Kit codecs, no extra package, null padding stripped).
- **Exact amounts:** u64 values stay `bigint`; amounts are formatted without floats, and JSON output converts `bigint` safely.
- **Batching:** metadata for many mints is fetched with `getMultipleAccounts`, at most 100 addresses per call.

## Requirements

- Node.js 22 or newer (tested on Node 24.13.1)
- npm

## Install

```bash
npm install
```

## Run

```bash
npx tsx src/inspect.ts <wallet or mint address>
```

Examples:

```bash
npx tsx src/inspect.ts EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v   # a legacy Token mint (USDC)
npx tsx src/inspect.ts 2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo   # a Token-2022 mint (PYUSD)
```

Output for the BONK mint (21 November 2026):

```json
{
  "type": "mint",
  "address": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  "program": "Token",
  "name": "Bonk",
  "symbol": "Bonk",
  "metadataSource": "metaplex pda",
  "supply": "87994290480625.99521",
  "decimals": 5,
  "mintAuthority": null,
  "freezeAuthority": null,
  "extensions": []
}
```

Each file in `src/` also runs on its own (`npm run slot`, `npm run balances`, `npm run mint`, `npm run extensions`, `npm run metadata`, `npm run null-padding`, `npm run bigint-json`). Most take an optional address as the first argument. `npm run typecheck` checks the types.

## RPC

By default the scripts use the public endpoint `https://api.mainnet.solana.com`. It is rate limited (100 requests per 10 seconds per IP) and not meant for production. To use your own endpoint, set `RPC_URL`:

```bash
RPC_URL=https://your-rpc.example.com npx tsx src/inspect.ts <address>
```

See `.env.example`. Never commit a real RPC URL that contains an API key.

## Versions

Pinned exactly in `package.json`: `@solana/kit` 8.6.0, `@solana-program/token` 0.18.0, `@solana-program/token-2022` 0.20.1, `@solana/sysvars` 8.6.0, `typescript` 7.0.2, `tsx` 4.23.15, `@types/node` 24.19.2.

## About

Built by Sanket, founder of [Tokenry](https://tokenry.tools), no-code tools to create, launch and manage tokens on Solana and EVM chains.

## License

MIT
