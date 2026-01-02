# Native Solana Atomic Round-Trip Swap

A pure native Solana program (no Anchor) that executes atomic buy/sell swaps on Raydium AMM pools within a single transaction.

## Features

- **Pure Native Solana**: No Anchor framework dependencies
- **Atomic Execution**: Both buy and sell operations execute in one transaction
- **Slippage Protection**: Configurable minimum output amounts
- **Custom Token Support**: Works with custom devnet tokens for testing
- **Devnet Ready**: Configured for devnet testing with custom tokens

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

## Usage

### Create Custom Devnet Tokens
```bash
npx ts-node simple-token-creator.ts
```

### Test Atomic Swap Structure
```bash
npx ts-node custom-atomic-swap.ts
```

### Test Pool Creation
```bash
npx ts-node simple-pool-creator.ts
```

### Run Full Test Suite
```bash
npm run test
```

## Custom Tokens Created

- **DEVUSDC**: `7yPDSToUbixNUmvRuEFFW4Q9omaqSUR192Xo4zuqGDSR` (1M supply)
- **DEVTEST**: `2BGP6B8yuyveuW8WtUHFY41xXaujKMFr8hYdTt42tqZk` (500K supply)

## How It Works

1. **Custom Token Creation**: Creates test tokens with full control
2. **Pool Simulation**: Simulates liquidity pool for testing
3. **Atomic Execution**: Both buy and sell operations in single transaction
4. **Buy Phase**: Swaps SOL → Token using Raydium AMM
5. **Sell Phase**: Immediately swaps Token → SOL in same transaction
6. **Atomic Guarantee**: Either both operations succeed or transaction reverts

The program uses native Solana instructions and borsh serialization for maximum efficiency.
