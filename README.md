# Native Solana Atomic Round-Trip Swap

A pure native Solana program (no Anchor) that executes atomic buy/sell swaps on Raydium AMM pools within a single transaction.

## Features

- **Pure Native Solana**: No Anchor framework dependencies
- **Atomic Execution**: Both buy and sell operations execute in one transaction
- **Slippage Protection**: Configurable minimum output amounts
- **Token Pair Agnostic**: Works with any Raydium pool
- **Devnet Ready**: Configured for devnet testing

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the program:
```bash
npm run build
```

3. Deploy to devnet:
```bash
./deploy.sh
```

4. Update `client.ts` with your deployed program ID

## Usage

```typescript
import { executeAtomicSwap } from './client';

// Execute round-trip swap
const signature = await executeAtomicSwap(
  "YOUR_PROGRAM_ID",        // Deployed program address
  "POOL_ID_HERE",           // Raydium pool address
  "TOKEN_MINT_HERE",        // Token mint address  
  0.01,                     // Amount in SOL
  500                       // 5% slippage tolerance
);
```

## Testing

The program is configured to use your devnet wallet automatically via environment variables. Simply run:

```bash
npm run test
```

## How It Works

1. **Buy Phase**: Swaps SOL → Token using Raydium AMM
2. **Sell Phase**: Immediately swaps Token → SOL in same transaction
3. **Atomic Guarantee**: Either both operations succeed or transaction reverts

The program uses native Solana instructions and borsh serialization for maximum efficiency.
