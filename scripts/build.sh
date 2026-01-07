#!/bin/bash

echo "Building Atomic Swap Program..."

# Build the program
anchor build

if [ $? -eq 0 ]; then
    echo "Build successful!"
    echo "Program built in target/deploy/"
    ls -la target/deploy/
else
    echo "Build failed!"
    exit 1
fi
