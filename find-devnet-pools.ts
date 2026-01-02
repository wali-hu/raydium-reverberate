import { Connection, PublicKey } from "@solana/web3.js";
import { LIQUIDITY_STATE_LAYOUT_V4 } from "@raydium-io/raydium-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const connection = new Connection("https://api.devnet.solana.com");

// Known Raydium program IDs for devnet
const RAYDIUM_PROGRAMS = [
  "DRaya7Kj3aMWQSy19kSjvmuwq9docCHofyP9kanQGaav", // Current devnet
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", // Legacy v4
  "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", // Alternative
];

// Known devnet pool addresses to test
const TEST_POOLS = [
  "83KtdsfcyB336kH8b3JRoWMLngc9q9MfAUcd8SdQegJn", // Current
  "8sLbNZoA1cfnvMJLPfp98ZLAnFSYCFApfJKMbiXNLwxj", // SOL-USDC
  "2QdhepnKRTLjjSqPL1PtKNwqrUkoLee5Gqs8bvZhRdMv", // Alternative
  "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2", // Mainnet reference
];

async function findValidPools() {
  console.log("🔍 Searching for valid devnet Raydium pools...\n");

  for (const poolAddress of TEST_POOLS) {
    try {
      console.log(`Testing pool: ${poolAddress}`);
      
      const poolPubkey = new PublicKey(poolAddress);
      const poolInfo = await connection.getAccountInfo(poolPubkey);
      
      if (!poolInfo) {
        console.log("❌ Pool not found\n");
        continue;
      }

      console.log(`✅ Pool exists, owner: ${poolInfo.owner.toString()}`);
      
      // Check if owner matches any known Raydium program
      const isRaydiumPool = RAYDIUM_PROGRAMS.includes(poolInfo.owner.toString());
      console.log(`Raydium pool: ${isRaydiumPool ? '✅' : '❌'}`);

      if (isRaydiumPool) {
        try {
          // Try to decode pool data
          const poolData = LIQUIDITY_STATE_LAYOUT_V4.decode(poolInfo.data);
          
          console.log("📊 Pool Details:");
          console.log(`  Base Mint: ${poolData.baseMint.toString()}`);
          console.log(`  Quote Mint: ${poolData.quoteMint.toString()}`);
          console.log(`  Base Vault: ${poolData.baseVault.toString()}`);
          console.log(`  Quote Vault: ${poolData.quoteVault.toString()}`);
          console.log(`  Status: ${poolData.status}`);
          
          // Check if pool is active
          if (poolData.status === 6) { // Active status
            console.log("🎯 VALID ACTIVE POOL FOUND!");
            console.log(`Use this pool: ${poolAddress}`);
            console.log(`Program ID: ${poolInfo.owner.toString()}\n`);
            
            return {
              poolAddress,
              programId: poolInfo.owner.toString(),
              baseMint: poolData.baseMint.toString(),
              quoteMint: poolData.quoteMint.toString(),
              baseVault: poolData.baseVault.toString(),
              quoteVault: poolData.quoteVault.toString()
            };
          }
        } catch (decodeError) {
          console.log("❌ Failed to decode pool data");
        }
      }
      console.log("");
      
    } catch (error) {
      console.log(`❌ Error checking pool: ${error.message}\n`);
    }
  }

  // If no pools found, search programmatically
  console.log("🔍 Searching for pools programmatically...");
  
  for (const programId of RAYDIUM_PROGRAMS) {
    try {
      console.log(`\nSearching pools for program: ${programId}`);
      
      const accounts = await connection.getProgramAccounts(
        new PublicKey(programId),
        {
          filters: [
            { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span }
          ]
        }
      );

      console.log(`Found ${accounts.length} potential pools`);
      
      for (let i = 0; i < Math.min(accounts.length, 3); i++) {
        const account = accounts[i];
        try {
          const poolData = LIQUIDITY_STATE_LAYOUT_V4.decode(account.account.data);
          
          if (poolData.status === 6) { // Active
            console.log(`\n🎯 ACTIVE POOL FOUND!`);
            console.log(`Pool: ${account.pubkey.toString()}`);
            console.log(`Base: ${poolData.baseMint.toString()}`);
            console.log(`Quote: ${poolData.quoteMint.toString()}`);
            
            return {
              poolAddress: account.pubkey.toString(),
              programId,
              baseMint: poolData.baseMint.toString(),
              quoteMint: poolData.quoteMint.toString(),
              baseVault: poolData.baseVault.toString(),
              quoteVault: poolData.quoteVault.toString()
            };
          }
        } catch (e) {
          // Skip invalid pools
        }
      }
    } catch (error) {
      console.log(`Error searching program ${programId}: ${error.message}`);
    }
  }

  return null;
}

findValidPools().then(result => {
  if (result) {
    console.log("\n🎉 SUCCESS! Use these values in your client:");
    console.log(`POOL_ADDRESS = "${result.poolAddress}"`);
    console.log(`PROGRAM_ID = "${result.programId}"`);
    console.log(`BASE_MINT = "${result.baseMint}"`);
    console.log(`QUOTE_MINT = "${result.quoteMint}"`);
  } else {
    console.log("\n❌ No valid active pools found on devnet");
    console.log("Consider using mainnet for testing or creating a devnet pool");
  }
}).catch(console.error);
