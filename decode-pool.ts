import { Connection, PublicKey } from "@solana/web3.js";
import { LIQUIDITY_STATE_LAYOUT_V4 } from "@raydium-io/raydium-sdk";

async function decodePoolData() {
  try {
    const connection = new Connection("https://api.devnet.solana.com", 'confirmed');
    const poolPubkey = new PublicKey("83KtdsfcyB336kH8b3JRoWMLngc9q9MfAUcd8SdQegJn");
    
    console.log("🔍 Fetching pool data...");
    const poolAccountInfo = await connection.getAccountInfo(poolPubkey);
    
    if (!poolAccountInfo) {
      console.log("❌ Pool not found");
      return;
    }
    
    console.log("✅ Pool found, decoding data...");
    const poolData = LIQUIDITY_STATE_LAYOUT_V4.decode(poolAccountInfo.data);
    
    console.log("\n📊 Pool Information:");
    console.log("Base Mint:", poolData.baseMint.toString());
    console.log("Quote Mint:", poolData.quoteMint.toString());
    console.log("Authority:", poolData.authority?.toString() || "N/A");
    console.log("Base Vault:", poolData.baseVault?.toString() || "N/A");
    console.log("Quote Vault:", poolData.quoteVault?.toString() || "N/A");
    console.log("Market ID:", poolData.marketId?.toString() || "N/A");
    console.log("Market Program:", poolData.marketProgramId?.toString() || "N/A");
    console.log("Open Orders:", poolData.openOrders?.toString() || "N/A");
    console.log("Target Orders:", poolData.targetOrders?.toString() || "N/A");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

decodePoolData();
