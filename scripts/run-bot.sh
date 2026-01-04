#!/bin/bash

case "$1" in
  "atomic")
    echo "Starting Atomic Swap Bot..."
    npx ts-node bots/atomic-swap-bot.ts
    ;;
  "volume")
    echo "Starting Volume Trader Bot..."
    npx ts-node bots/volume-trader-bot.ts
    ;;
  *)
    echo "Usage: $0 {atomic|volume}"
    exit 1
    ;;
esac
