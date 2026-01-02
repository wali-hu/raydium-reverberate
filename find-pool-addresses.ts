import { Connection, PublicKey } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";

const connection = new Connection("https://api.devnet.solana.com");

// Raydium devnet program ID
const RAYDIUM_AMM_PROGRAM = new PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8");

// Your custom token
const DEVUSDC = new PublicKey("7yPDSToUbixNUmvRuEFFW4Q9omaqSUR192Xo4zuqGDSR");

async function findPoolAddresses() {
  console.log("Searching for Raydium pools on devnet...");
  
  try {
    // Get all accounts owned by Raydium AMM program
    const accounts = await connection.getProgramAccounts(RAYDIUM_AMM_PROGRAM, {
      filters: [
        { dataSize: 752 } // AMM pool account size
      ]
    });
    
    console.log(`Found ${accounts.length} AMM accounts`);
    
    for (let i = 0; i < Math.min(accounts.length, 10); i++) {
      const account = accounts[i];
      console.log(`\nPool ${i + 1}:`);
      console.log(`Address: ${account.pubkey.toString()}`);
      
      // Try to parse basic pool info
      const data = account.account.data;
      if (data.length >= 752) {
        // Extract mint addresses (simplified parsing)
        const baseMint = new PublicKey(data.slice(400, 432));
        const quoteMint = new PublicKey(data.slice(432, 464));
        
        console.log(`Base Mint: ${baseMint.toString()}`);
        console.log(`Quote Mint: ${quoteMint.toString()}`);
        
        // Check if this is SOL/USDC or our custom token pool
        if (baseMint.equals(NATIVE_MINT) || quoteMint.equals(NATIVE_MINT)) {
          console.log("🟢 SOL pool found!");
        }
        if (baseMint.equals(DEVUSDC) || quoteMint.equals(DEVUSDC)) {
          console.log("🟡 DEVUSDC pool found!");
        }
      }
    }
    
    // Also check for known devnet pools
    console.log("\n=== Known Devnet Pools ===");
    const knownPools = [
      "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2", // SOL/USDC
      "7XawhbbxtsRcQA8KTkHT9f9nc6d69UwqCDh6U5EEbEmX", // Another common pool
    ];
    
    for (const poolId of knownPools) {
      try {
        const poolAccount = await connection.getAccountInfo(new PublicKey(poolId));
        if (poolAccount) {
          console.log(`✅ Pool ${poolId} exists`);
          console.log(`Owner: ${poolAccount.owner.toString()}`);
        }
      } catch (e) {
        console.log(`❌ Pool ${poolId} not found`);
      }
    }
    
  } catch (error) {
    console.error("Error finding pools:", error);
  }
}

findPoolAddresses();
