import { Connection, PublicKey } from "@solana/web3.js";
import { LIQUIDITY_STATE_LAYOUT_V4 } from "@raydium-io/raydium-sdk";

async function findAmmAuthority() {
  const connection = new Connection("https://api.devnet.solana.com");
  const poolPubkey = new PublicKey("83KtdsfcyB336kH8b3JRoWMLngc9q9MfAUcd8SdQegJn");
  const raydiumProgram = new PublicKey("DRaya7Kj3aMWQSy19kSjvmuwq9docCHofyP9kanQGaav");
  
  // Method 1: Try standard Raydium authority derivation
  const [derivedAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("amm authority")],
    raydiumProgram
  );
  
  console.log("Derived Authority:", derivedAuthority.toString());
  
  // Method 2: Check pool data more carefully
  const poolInfo = await connection.getAccountInfo(poolPubkey);
  if (poolInfo) {
    const poolData = LIQUIDITY_STATE_LAYOUT_V4.decode(poolInfo.data);
    
    // Print all fields to find authority
    console.log("\nAll Pool Fields:");
    Object.keys(poolData).forEach(key => {
      const value = poolData[key];
      if (value && typeof value === 'object' && value.toString) {
        console.log(`${key}:`, value.toString());
      }
    });
  }
}

findAmmAuthority();
