import { AtomicSwapClient } from "./atomic-swap-client";

async function runExample() {
  // Configuration
  const RPC_URL = "https://api.devnet.solana.com";
  const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
  
  if (!PRIVATE_KEY) {
    console.error("Please set PRIVATE_KEY environment variable");
    console.log("Example: export PRIVATE_KEY='[1,2,3,...]'");
    process.exit(1);
  }

  try {
    console.log("Atomic Round-Trip Swap Example");
    console.log("================================");
    
    const client = new AtomicSwapClient(RPC_URL, PRIVATE_KEY);
    
    // SOL-USDC pool on devnet
    const poolId = "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2";
    const amountSol = 0.01; // 0.01 SOL
    const slippage = 0.01; // 1% slippage
    
    console.log(`Wallet: ${client.wallet.publicKey.toString()}`);
    console.log(`Pool: ${poolId}`);
    console.log(`Amount: ${amountSol} SOL`);
    console.log(`Slippage: ${slippage * 100}%`);
    console.log("");
    
    // Execute the atomic swap
    const signature = await client.executeAtomicSwap(poolId, amountSol, slippage);
    
    console.log("");
    console.log("Atomic swap completed successfully!");
    console.log(`Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
  } catch (error) {
    console.error("Error executing atomic swap:", error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  runExample();
}
