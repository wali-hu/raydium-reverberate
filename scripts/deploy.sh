#!/bin/bash

echo "Deploying Atomic Swap Program..."

# Deploy the program
anchor deploy

if [ $? -eq 0 ]; then
    echo "Deployment successful!"
    echo "Program deployed to Solana"
else
    echo "Deployment failed!"
    exit 1
fi
