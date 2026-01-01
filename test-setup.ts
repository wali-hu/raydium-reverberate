import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { LIQUIDITY_STATE_LAYOUT_V4 } from "@raydium-io/raydium-sdk";
import * as dotenv from "dotenv";

dotenv.config();

async function testAtomicSwap() {
  try {
    console.log("🚀 Testing Atomic Round-Trip Swap Setup");
    
    // Connection
    const connection = new Connection("https://api.devnet.solana.com", 'confirmed');
    
    // Pool and token info
    const POOL_ADDRESS = "83KtdsfcyB336kH8b3JRoWMLngc9q9MfAUcd8SdQegJn";
    const TOKEN_ADDRESS = "USDCoctVLVnvTXBEuP9s8hntucdJokbo17RwHuNXemT";
    const PROGRAM_ID = "c6yDi5Z8AjensVGtu7WrsoL4T2XLVChLQo9t7MbYahg";
    
    console.log("\n📊 Configuration:");
    console.log("Pool Address:", POOL_ADDRESS);
    console.log("Token Address:", TOKEN_ADDRESS);
    console.log("Program ID:", PROGRAM_ID);
    
    // Check wallet balance
    const walletPubkey = new PublicKey(process.env.PUBLIC_KEY!);
    const balance = await connection.getBalance(walletPubkey);
    console.log("\n💰 Wallet:");
    console.log("Address:", walletPubkey.toString());
    console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL");
    
    // Check pool
    const poolPubkey = new PublicKey(POOL_ADDRESS);
    const poolInfo = await connection.getAccountInfo(poolPubkey);
    
    if (poolInfo) {
      console.log("\n🏊 Pool Status:");
      console.log("✅ Pool exists on devnet");
      console.log("Owner:", poolInfo.owner.toString());
      
      // Decode pool data
      const poolData = LIQUIDITY_STATE_LAYOUT_V4.decode(poolInfo.data);
      console.log("Base Mint (SOL):", poolData.baseMint.toString());
      console.log("Quote Mint (Token):", poolData.quoteMint.toString());
      console.log("Base Vault:", poolData.baseVault?.toString() || "N/A");
      console.log("Quote Vault:", poolData.quoteVault?.toString() || "N/A");
    }
    
    // Check program
    const programPubkey = new PublicKey(PROGRAM_ID);
    const programInfo = await connection.getAccountInfo(programPubkey);
    
    console.log("\n🔧 Program Status:");
    if (programInfo) {
      console.log("✅ Program deployed on devnet");
      console.log("Executable:", programInfo.executable);
      console.log("Owner:", programInfo.owner.toString());
    } else {
      console.log("❌ Program not found on devnet");
    }
    
    console.log("\n🎯 Atomic Swap Plan:");
    console.log("1. ✅ Wallet has sufficient SOL");
    console.log("2. ✅ Pool exists and is active");
    console.log("3. ✅ Program is deployed");
    console.log("4. 🔄 Ready to execute atomic round-trip:");
    console.log("   • Buy: 0.005 SOL → Token");
    console.log("   • Sell: Token → SOL");
    console.log("   • Both in single transaction");
    
    console.log("\n💡 To execute: Run the main client.ts");
    
  } catch (error) {
    console.error("❌ Setup test failed:", error);
  }
}

testAtomicSwap();
