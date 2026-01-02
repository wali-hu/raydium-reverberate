import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com");

// Use the first SOL pool we found
const POOL_ID = "HBdAeAsQjM5t6oL7i1qfK5TgBDBvUpdVpnxoxgx5Q752";

async function getPoolDetails() {
  console.log(`Getting complete details for pool: ${POOL_ID}`);
  
  try {
    const poolAccount = await connection.getAccountInfo(new PublicKey(POOL_ID));
    
    if (!poolAccount) {
      console.log("Pool not found");
      return;
    }
    
    const data = poolAccount.account.data;
    console.log(`Pool data size: ${data.length} bytes`);
    
    // Parse AMM pool structure (simplified)
    const poolInfo = {
      poolId: POOL_ID,
      // These offsets are approximate - you'd need exact Raydium struct layout
      authority: new PublicKey(data.slice(8, 40)).toString(),
      openOrders: new PublicKey(data.slice(40, 72)).toString(),
      targetOrders: new PublicKey(data.slice(72, 104)).toString(),
      baseVault: new PublicKey(data.slice(104, 136)).toString(),
      quoteVault: new PublicKey(data.slice(136, 168)).toString(),
      baseMint: new PublicKey(data.slice(400, 432)).toString(),
      quoteMint: new PublicKey(data.slice(432, 464)).toString(),
    };
    
    console.log("\n=== POOL ADDRESSES FOR YOUR SMART CONTRACT ===");
    console.log(`Pool ID: ${poolInfo.poolId}`);
    console.log(`Authority: ${poolInfo.authority}`);
    console.log(`Open Orders: ${poolInfo.openOrders}`);
    console.log(`Target Orders: ${poolInfo.targetOrders}`);
    console.log(`Base Vault: ${poolInfo.baseVault}`);
    console.log(`Quote Vault: ${poolInfo.quoteVault}`);
    console.log(`Base Mint: ${poolInfo.baseMint}`);
    console.log(`Quote Mint: ${poolInfo.quoteMint}`);
    
    // Create the updated code
    console.log("\n=== COPY THIS TO YOUR CODE ===");
    console.log(`
const poolAccounts = {
  poolId: new PublicKey("${poolInfo.poolId}"),
  authority: new PublicKey("${poolInfo.authority}"),
  openOrders: new PublicKey("${poolInfo.openOrders}"),
  targetOrders: new PublicKey("${poolInfo.targetOrders}"),
  baseVault: new PublicKey("${poolInfo.baseVault}"),
  quoteVault: new PublicKey("${poolInfo.quoteVault}"),
  baseMint: new PublicKey("${poolInfo.baseMint}"),
  quoteMint: new PublicKey("${poolInfo.quoteMint}"),
};`);
    
  } catch (error) {
    console.error("Error getting pool details:", error);
  }
}

getPoolDetails();
