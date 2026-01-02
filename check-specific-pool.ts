import { Connection, PublicKey } from "@solana/web3.js";
import { LIQUIDITY_STATE_LAYOUT_V4 } from "@raydium-io/raydium-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const connection = new Connection("https://api.devnet.solana.com");

async function checkPool(poolAddress: string) {
  console.log(`🔍 Checking pool: ${poolAddress}\n`);
  
  try {
    const poolPubkey = new PublicKey(poolAddress);
    const poolInfo = await connection.getAccountInfo(poolPubkey);
    
    if (!poolInfo) {
      console.log("❌ Pool not found");
      return null;
    }

    console.log(`✅ Pool found`);
    console.log(`Owner: ${poolInfo.owner.toString()}`);
    console.log(`Data size: ${poolInfo.data.length}`);
    
    // Decode pool data
    const poolData = LIQUIDITY_STATE_LAYOUT_V4.decode(poolInfo.data);
    
    console.log("\n📊 Pool Details:");
    console.log(`Base Mint: ${poolData.baseMint.toString()}`);
    console.log(`Quote Mint: ${poolData.quoteMint.toString()}`);
    console.log(`Base Vault: ${poolData.baseVault.toString()}`);
    console.log(`Quote Vault: ${poolData.quoteVault.toString()}`);
    console.log(`AMM Authority: ${poolData.authority.toString()}`);
    console.log(`Status: ${poolData.status} ${poolData.status === 6 ? '(ACTIVE)' : '(INACTIVE)'}`);
    
    // Check vault balances
    const baseVaultInfo = await connection.getAccountInfo(poolData.baseVault);
    const quoteVaultInfo = await connection.getAccountInfo(poolData.quoteVault);
    
    console.log("\n💰 Vault Info:");
    console.log(`Base Vault Balance: ${baseVaultInfo ? 'Has funds' : 'No funds'}`);
    console.log(`Quote Vault Balance: ${quoteVaultInfo ? 'Has funds' : 'No funds'}`);
    
    if (poolData.status === 6 && baseVaultInfo && quoteVaultInfo) {
      console.log("\n🎯 THIS POOL IS VALID AND ACTIVE!");
      return {
        poolAddress,
        programId: poolInfo.owner.toString(),
        baseMint: poolData.baseMint.toString(),
        quoteMint: poolData.quoteMint.toString(),
        baseVault: poolData.baseVault.toString(),
        quoteVault: poolData.quoteVault.toString(),
        authority: poolData.authority.toString()
      };
    }
    
    return null;
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return null;
  }
}

// Check the pool we know exists
checkPool("83KtdsfcyB336kH8b3JRoWMLngc9q9MfAUcd8SdQegJn").then(result => {
  if (result) {
    console.log("\n✅ VALID POOL FOUND! Update your client.ts with:");
    console.log(`const POOL_ADDRESS = "${result.poolAddress}";`);
    console.log(`const RAYDIUM_AMM_PROGRAM = new PublicKey("${result.programId}");`);
    console.log(`const TOKEN_ADDRESS = "${result.quoteMint}";`);
  }
});
