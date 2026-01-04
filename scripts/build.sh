#!/bin/bash
echo "Building Solana program..."
cargo build-bpf
echo "Deploying to devnet..."
solana program deploy target/deploy/atomic_round_trip.so --url devnet
echo "Deployment completed!"
