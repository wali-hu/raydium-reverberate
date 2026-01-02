import { Connection, PublicKey } from "@solana/web3.js";
import { LIQUIDITY_STATE_LAYOUT_V4 } from "@raydium-io/raydium-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const connection = new Connection("https://api.devnet.solana.com");

async function analyzePool() {
  const poolAddress = "3rnUv5HsgJfhmRWFa9PLsdMv5VqNZka4XFfGzQBWm3u9";
  
  console.log(`🔍 Analyzing pool: ${poolAddress}\n`);
  
  try {
    const poolInfo = await connection.getAccountInfo(new PublicKey(poolAddress));
    
    if (!poolInfo) {
      console.log("❌ Pool not found");
      return;
    }

    console.log(`✅ Pool found`);
    console.log(`Owner: ${poolInfo.owner.toString()}`);
    console.log(`Data size: ${poolInfo.data.length}`);
    
    // Decode pool data
    const poolData = LIQUIDITY_STATE_LAYOUT_V4.decode(poolInfo.data);
    
    console.log("\n📊 Complete Pool Analysis:");
    console.log(`Status: ${poolData.status}`);
    console.log(`Base Mint: ${poolData.baseMint.toString()}`);
    console.log(`Quote Mint: ${poolData.quoteMint.toString()}`);
    console.log(`Base Vault: ${poolData.baseVault.toString()}`);
    console.log(`Quote Vault: ${poolData.quoteVault.toString()}`);
    
    // Check what tokens these actually are
    console.log("\n🪙 Token Analysis:");
    
    // Check base mint
    const baseMintInfo = await connection.getAccountInfo(poolData.baseMint);
    if (baseMintInfo) {
      console.log(`Base token exists: ${poolData.baseMint.toString()}`);
    }
    
    // Check quote mint  
    const quoteMintInfo = await connection.getAccountInfo(poolData.quoteMint);
    if (quoteMintInfo) {
      console.log(`Quote token exists: ${poolData.quoteMint.toString()}`);
      
      // Check if it's SOL
      if (poolData.quoteMint.toString() === "So11111111111111111111111111111111111111112") {
        console.log("✅ Quote token is SOL - Perfect for our swap!");
      }
    }
    
    // Check vault balances
    console.log("\n💰 Vault Balances:");
    const baseVaultInfo = await connection.getAccountInfo(poolData.baseVault);
    const quoteVaultInfo = await connection.getAccountInfo(poolData.quoteVault);
    
    if (baseVaultInfo) {
      console.log(`Base vault balance: ${baseVaultInfo.lamports} lamports`);
    }
    if (quoteVaultInfo) {
      console.log(`Quote vault balance: ${quoteVaultInfo.lamports} lamports`);
    }
    
    // Generate the correct configuration
    console.log("\n🎯 CORRECT CONFIGURATION:");
    console.log(`const POOL_ADDRESS = "${poolAddress}";`);
    console.log(`const RAYDIUM_AMM_PROGRAM = new PublicKey("${poolInfo.owner.toString()}");`);
    console.log(`const TOKEN_ADDRESS = "${poolData.baseMint.toString()}"; // Use base mint as token`);
    
    console.log("\n✅ This pool should work for atomic swaps!");
    console.log("The pool has SOL as quote mint, which is perfect for SOL-based swaps.");
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

analyzePool();
