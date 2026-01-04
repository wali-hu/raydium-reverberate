# Solana Atomic Round-Trip Swap Bot

**Author: Abdullah**  
**Solana Trading Bot Development**

A high-performance Solana trading bot that performs atomic round-trip swaps using native Solana programs and Raydium pools. The bot creates its own AMM pools and executes volume trading with 100% success rate.

## Features

- **Atomic Swaps**: Execute SOL ↔ Token swaps in single transactions
- **Custom AMM Pools**: Creates and manages its own liquidity pools
- **Volume Trading**: Automated high-frequency trading with configurable parameters
- **Native Solana**: Built with pure Solana Web3.js and SPL Token libraries
- **Rust Program**: Custom on-chain program for atomic swap operations

## Quick Start

### Prerequisites

- Node.js 18+
- Rust and Solana CLI tools
- Solana wallet with SOL for gas fees

### Installation

```bash
git clone <repository-url>
cd atomic_round_trip
npm install
```

### Configuration

1. Copy the environment template:
```bash
cp config/.env.example config/.env
```

2. Edit `config/.env` with your details:
```env
PRIVATE_KEY=your_base58_encoded_private_key
RPC_URL=https://api.devnet.solana.com
```

### Deploy the Rust Program

```bash
npm run build-program
```

### Run the Bots

**Atomic Swap Bot** (Creates own pool):
```bash
npm run run:atomic
```

**Volume Trader Bot** (Uses existing pools):
```bash
npm run run:volume
```

## Bot Performance

Both bots achieve **100% success rate** with the following results:

### Final Working Bot
- Creates custom AMM pool
- Executes 3 atomic swaps of 0.01 SOL each
- Success rate: 100% (3/3)

### Working Bot  
- Uses existing Raydium pools
- Executes volume swaps with 2-second intervals
- Success rate: 100% (3/3)

## Architecture

```
atomic_round_trip/
├── bots/                    # Trading bot implementations
│   ├── atomic-swap-bot.ts   # Atomic round-trip swap bot
│   └── volume-trader-bot.ts # Volume trading bot
├── config/                  # Configuration files
│   ├── .env.example         # Environment template
│   └── constants.ts         # Application constants
├── scripts/                 # Utility scripts
│   ├── build.sh            # Program build script
│   ├── deploy.sh           # Deployment script
│   └── run-bot.sh          # Bot runner script
├── src/                    # Rust program source
│   └── lib.rs              # On-chain program logic
└── docs/                   # Documentation
```

### TypeScript Bots
- `bots/atomic-swap-bot.ts`: Main atomic swap bot with pool creation
- `bots/volume-trader-bot.ts`: Volume trading bot for existing pools

### Rust Program
- `src/lib.rs`: On-chain program for atomic swap operations
- Handles token transfers and pool interactions

### Key Dependencies
- `@solana/web3.js`: Solana blockchain interaction
- `@solana/spl-token`: SPL token operations
- `@raydium-io/raydium-sdk`: Raydium DEX integration
- `borsh`: Serialization for Rust program communication

## Usage Examples

The bots automatically:
1. Connect to Solana devnet
2. Create/find liquidity pools
3. Execute atomic swaps
4. Display transaction links and results

Sample output:
```
Starting Final Volume Bot with Own Pool
Wallet: FQ7zu26PVPCbiDuXtbFtHzMeVVtJSfQR4xwQDjsz8H7t
SOL Balance: 11.26092852
Pool created: 5fZHcQk76Pf3nzCc9fcgHsHDdWRpTa744XAJgQP1qfH9
Atomic swap completed: https://explorer.solana.com/tx/...
Results: 3/3 successful (100.0%)
```

## Development

### Build Rust Program
```bash
npm run build-program
```

### Deploy to Solana
```bash
npm run deploy
```

### Test Bots
```bash
npm run run:atomic  # Test atomic swap bot
npm run run:volume  # Test volume trader bot
```

## Network Support

- **Devnet**: Fully tested and operational
- **Mainnet**: Ready for production deployment

## Security

- Private keys are loaded from environment variables
- All transactions are atomic (succeed or fail completely)
- Built-in error handling and retry mechanisms

## License

MIT License 
