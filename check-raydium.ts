import { Connection, PublicKey } from "@solana/web3.js";

async function checkRaydiumProgram() {
  const connection = new Connection("https://api.devnet.solana.com");
  const poolPubkey = new PublicKey("83KtdsfcyB336kH8b3JRoWMLngc9q9MfAUcd8SdQegJn");
  const poolInfo = await connection.getAccountInfo(poolPubkey);
  
  if (poolInfo) {
    console.log("✅ Pool found");
    console.log("Pool Owner (Raydium Program ID):", poolInfo.owner.toString());
    
    // Check if this matches our current Raydium program ID
    const currentRaydiumId = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
    console.log("Current Raydium ID in client:", currentRaydiumId);
    console.log("Match:", poolInfo.owner.toString() === currentRaydiumId ? "✅" : "❌");
  }
}

checkRaydiumProgram();
