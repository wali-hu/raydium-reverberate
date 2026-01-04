#!/bin/bash

# Compile TypeScript first
echo "Compiling TypeScript..."
npx tsc

case "$1" in
  "atomic")
    echo "Starting Atomic Swap Bot..."
    node dist/bots/atomic-swap-bot.js
    ;;
  "volume")
    echo "Starting Volume Trader Bot..."
    node dist/bots/volume-trader-bot.js
    ;;
  *)
    echo "Usage: $0 {atomic|volume}"
    exit 1
    ;;
esac
