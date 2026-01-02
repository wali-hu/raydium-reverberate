#!/bin/bash

echo "Building and deploying atomic swap program..."

# Build the program
cargo build-sbf --manifest-path=Cargo.toml --sbf-out-dir=target/deploy

# Deploy to devnet
echo "Deploying to devnet..."
PROGRAM_ID=$(solana program deploy target/deploy/atomic_swap.so --url devnet | grep "Program Id:" | awk '{print $3}')

echo "Program deployed successfully!"
echo "Program ID: $PROGRAM_ID"

# Update the TypeScript file with the program ID
sed -i "s/YOUR_PROGRAM_ID_HERE/$PROGRAM_ID/g" raydium-atomic-swap.ts

echo "Updated raydium-atomic-swap.ts with program ID: $PROGRAM_ID"
echo "Ready to test atomic swaps!"
