#!/bin/bash

# Build the program
echo "Building Solana program..."
cargo build-bpf --manifest-path=Cargo.toml --bpf-out-dir=target/deploy

# Deploy to devnet
echo "Deploying to devnet..."
solana config set --url devnet
solana program deploy target/deploy/atomic_swap.so --keypair ~/.config/solana/id.json

echo "Deployment complete!"
echo "Update the PROGRAM_ID in client.ts with the deployed program address."
