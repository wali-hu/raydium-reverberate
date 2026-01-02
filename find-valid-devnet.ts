import { Connection, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";

dotenv.config();

const connection = new Connection("https://api.devnet.solana.com");

// Updated devnet program IDs from research
const DEVNET_PROGRAMS = [
  "HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8", // Devnet AMM from Stack Exchange
  "DRaya7Kj3aMWQSy19kSjvmuwq9docCHofyP9kanQGaav", // Current devnet
  "AMMjRTfWhP73x9fM6jdoXRfgFJXR97NFRkV8fYJUrnLE", // Public testnet AMM
  "DRay6fNdQ5J82H7xV6uq2aV3mNrUZ1J4PgSKsWgptcm6", // LaunchLab devnet
];

async function findDevnetPools() {
  console.log("🔍 Searching for active Raydium devnet pools...\n");

  for (const programId of DEVNET_PROGRAMS) {
    console.log(`\n📋 Checking program: ${programId}`);
    
    try {
      // Get all accounts for this program
      const accounts = await connection.getProgramAccounts(
        new PublicKey(programId),
        {
          filters: [
            { dataSize: 752 } // Standard Raydium pool size
          ]
        }
      );

      console.log(`Found ${accounts.length} accounts`);

      if (accounts.length > 0) {
        // Check first few accounts
        for (let i = 0; i < Math.min(accounts.length, 5); i++) {
          const account = accounts[i];
          console.log(`\n🎯 Pool candidate: ${account.pubkey.toString()}`);
          
          // Check if account has data and is funded
          if (account.account.data.length > 0 && account.account.lamports > 0) {
            console.log(`✅ Pool has data and is funded`);
            console.log(`Data size: ${account.account.data.length}`);
            console.log(`Lamports: ${account.account.lamports}`);
            
            // This is likely a valid pool
            console.log(`\n🎉 POTENTIAL VALID POOL FOUND!`);
            console.log(`Pool Address: ${account.pubkey.toString()}`);
            console.log(`Program ID: ${programId}`);
            
            return {
              poolAddress: account.pubkey.toString(),
              programId: programId
            };
          }
        }
      }
    } catch (error) {
      console.log(`❌ Error checking program ${programId}: ${error.message}`);
    }
  }

  // Also check some known mainnet pools that might exist on devnet
  const KNOWN_POOLS = [
    "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2", // SOL-USDC mainnet
    "83KtdsfcyB336kH8b3JRoWMLngc9q9MfAUcd8SdQegJn", // Current test pool
  ];

  console.log("\n🔍 Checking known pool addresses...");
  
  for (const poolAddress of KNOWN_POOLS) {
    try {
      const poolInfo = await connection.getAccountInfo(new PublicKey(poolAddress));
      if (poolInfo && poolInfo.lamports > 0) {
        console.log(`\n✅ Found active pool: ${poolAddress}`);
        console.log(`Owner: ${poolInfo.owner.toString()}`);
        console.log(`Data size: ${poolInfo.data.length}`);
        
        return {
          poolAddress: poolAddress,
          programId: poolInfo.owner.toString()
        };
      }
    } catch (error) {
      console.log(`❌ Pool ${poolAddress} not accessible`);
    }
  }

  return null;
}

// Alternative: Create a simple test with Jupiter API to find active devnet pools
async function checkJupiterDevnet() {
  console.log("\n🔍 Checking Jupiter for devnet tokens...");
  
  try {
    // Jupiter doesn't have devnet, but we can check what tokens exist on devnet
    const response = await fetch("https://token.jup.ag/all");
    const tokens = await response.json();
    
    // Filter for devnet-like tokens (this is just for reference)
    console.log("Jupiter has mainnet tokens, but we need devnet equivalents");
    
    // Common devnet token mints
    const DEVNET_TOKENS = [
      "So11111111111111111111111111111111111111112", // SOL (same on all networks)
      "USDCoctVLVnvTXBEuP9s8hntucdJokbo17RwHuNXemT", // Devnet USDC
      "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // Devnet USDC alternative
    ];
    
    console.log("Common devnet tokens:");
    DEVNET_TOKENS.forEach(token => console.log(`  ${token}`));
    
  } catch (error) {
    console.log("Could not fetch Jupiter data");
  }
}

async function main() {
  const result = await findDevnetPools();
  
  if (result) {
    console.log("\n🎉 SUCCESS! Use this configuration:");
    console.log(`const POOL_ADDRESS = "${result.poolAddress}";`);
    console.log(`const RAYDIUM_AMM_PROGRAM = new PublicKey("${result.programId}");`);
    
    // Test the pool
    console.log("\n🧪 Testing pool accessibility...");
    try {
      const poolInfo = await connection.getAccountInfo(new PublicKey(result.poolAddress));
      if (poolInfo) {
        console.log("✅ Pool is accessible and has data");
        console.log("✅ Ready to use in your atomic swap!");
      }
    } catch (error) {
      console.log("❌ Pool test failed:", error.message);
    }
  } else {
    console.log("\n❌ No active devnet pools found");
    console.log("💡 Recommendations:");
    console.log("1. Use mainnet for testing (more liquidity)");
    console.log("2. Create your own devnet pool");
    console.log("3. Use simulation mode for testing");
  }
  
  await checkJupiterDevnet();
}

main().catch(console.error);
