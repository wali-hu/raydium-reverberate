# Solana Atomic Round-Trip Swap

**Author: Abdullah**  
**Advanced Solana Trading Bot with Atomic Swaps**

A production-ready Solana program that executes atomic round-trip swaps using Raydium AMM pools. The program performs buy and sell operations within a single transaction, ensuring atomicity and preventing partial execution.

## Features

- **Atomic Transactions**: Buy and sell operations execute atomically - either both succeed or both fail
- **Raydium Integration**: Direct integration with Raydium AMM v4 program
- **Slippage Protection**: Built-in slippage tolerance for both buy and sell operations
- **Auto Account Creation**: Automatically creates associated token accounts if needed
- **Volume Simulation**: Perfect for volume testing and market making strategies

## Architecture

### Smart Contract (Rust/Anchor)
- `programs/atomic-swap/src/lib.rs` - Main Solana program
- Implements `atomic_round_trip_swap` instruction
- Handles all Raydium AMM interactions

### Client (TypeScript)
- `client/atomic-swap-client.ts` - Web3 client for calling the program
- Raydium SDK v2 integration for pool data
- Automatic transaction building and execution

## Quick Start

### Prerequisites
- Rust and Solana CLI tools
- Node.js 18+
- Anchor Framework

### Installation
```bash
git clone <repository-url>
cd atomic_round_trip
npm install
```

### Build Program
```bash
npm run build
# or
./scripts/build.sh
```

### Deploy Program
```bash
npm run deploy
# or
./scripts/deploy.sh
```

### Configure Environment
```bash
cp config/.env.example config/.env
# Edit config/.env with your settings:
# PRIVATE_KEY=your_base58_private_key
# RPC_URL=https://api.devnet.solana.com
```

### Execute Atomic Swap
```bash
npm run run:atomic
```

## How It Works

### 1. Atomic Swap Flow
```
Single Transaction:
├── Buy: SOL → Token (using Raydium AMM)
├── Get received token amount
└── Sell: Token → SOL (using same pool)
```

### 2. Program Logic
- Calls Raydium AMM program twice within one transaction
- First swap: SOL to target token
- Reloads token account to get exact received amount
- Second swap: All received tokens back to SOL
- Both operations use slippage protection

### 3. Client Integration
- Uses Raydium SDK v2 for pool data and calculations
- Automatically creates token accounts if needed
- Handles all transaction building and signing

## Usage Examples

### Basic Usage
```typescript
import { AtomicSwapClient } from './client/atomic-swap-client';

const client = new AtomicSwapClient(RPC_URL, PRIVATE_KEY);
const signature = await client.executeAtomicSwap(
  "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2", // SOL-USDC pool
  0.01, // 0.01 SOL
  0.01  // 1% slippage
);
```

### Volume Simulation
```typescript
// Execute multiple atomic swaps for volume
for (let i = 0; i < 10; i++) {
  await client.executeAtomicSwap(poolId, 0.01, 0.01);
  await new Promise(resolve => setTimeout(resolve, 2000));
}
```

## Program Accounts

The atomic swap instruction requires these accounts:
- Raydium AMM program and pool accounts
- Serum market accounts (for AMM v4 integration)
- User token accounts (created automatically)
- Token program

## Security Features

- **Atomic Execution**: No partial swaps possible
- **Slippage Protection**: Minimum amount out enforced on-chain
- **Account Validation**: All accounts validated by Anchor
- **CPI Security**: Safe cross-program invocations to Raydium

## Network Support

- **Devnet**: Fully tested and operational
- **Mainnet**: Production ready

## Performance

- **Single Transaction**: Both swaps in one atomic transaction
- **Low Latency**: Direct program-to-program calls
- **Gas Efficient**: Optimized instruction layout
- **High Success Rate**: Atomic nature prevents failed states

## Development

### Testing
```bash
anchor test
```

### Local Development
```bash
# Start local validator
solana-test-validator

# Deploy to local
anchor deploy --provider.cluster localnet
```

## License

MIT License 
