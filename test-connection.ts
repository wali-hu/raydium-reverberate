import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as dotenv from "dotenv";

dotenv.config();

async function testConnection() {
  try {
    console.log("🔗 Testing devnet connection...");
    
    const connection = new Connection("https://api.devnet.solana.com", 'confirmed');
    
    // Test basic connection
    const version = await connection.getVersion();
    console.log("✅ Connected to Solana devnet");
    console.log("Version:", version['solana-core']);
    
    // Check wallet balance
    const walletPubkey = new PublicKey(process.env.PUBLIC_KEY!);
    const balance = await connection.getBalance(walletPubkey);
    
    console.log("\n💰 Wallet Info:");
    console.log("Address:", walletPubkey.toString());
    console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL");
    
    // Check pool exists
    const poolPubkey = new PublicKey("83KtdsfcyB336kH8b3JRoWMLngc9q9MfAUcd8SdQegJn");
    const poolInfo = await connection.getAccountInfo(poolPubkey);
    
    if (poolInfo) {
      console.log("\n🏊 Pool Info:");
      console.log("✅ Pool exists on devnet");
      console.log("Owner:", poolInfo.owner.toString());
      console.log("Data length:", poolInfo.data.length);
    } else {
      console.log("\n❌ Pool not found on devnet");
    }
    
    // Check token exists
    const tokenPubkey = new PublicKey("USDCoctVLVnvTXBEuP9s8hntucdJokbo17RwHuNXemT");
    const tokenInfo = await connection.getAccountInfo(tokenPubkey);
    
    if (tokenInfo) {
      console.log("\n🪙 Token Info:");
      console.log("✅ Token exists on devnet");
      console.log("Owner:", tokenInfo.owner.toString());
    } else {
      console.log("\n❌ Token not found on devnet");
    }
    
  } catch (error) {
    console.error("❌ Connection test failed:", error);
  }
}

testConnection();
