import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

async function atomicSwapDirect() {
  try {
    console.log("🚀 Direct Atomic Round-Trip Swap on Devnet");
    
    const connection = new Connection("https://api.devnet.solana.com", 'confirmed');
    const privateKeyBytes = bs58.decode(process.env.PRIVATE_KEY!);
    const wallet = Keypair.fromSecretKey(privateKeyBytes);
    
    const balance = await connection.getBalance(wallet.publicKey);
    console.log("Wallet Balance:", balance / LAMPORTS_PER_SOL, "SOL");
    
    // Raydium swap instruction data (instruction 9 = swap)
    const swapInstruction = 9;
    const amountIn = BigInt(0.005 * LAMPORTS_PER_SOL); // 0.005 SOL
    const minAmountOut = BigInt(0.004 * LAMPORTS_PER_SOL); // 5% slippage
    
    // Create swap instruction data
    let instructionData = Buffer.alloc(17);
    instructionData.writeUInt8(swapInstruction, 0);
    instructionData.writeBigUInt64LE(amountIn, 1);
    instructionData.writeBigUInt64LE(minAmountOut, 9);
    
    console.log("\\n🔄 Creating direct Raydium swap...");
    
    // Direct call to Raydium (SOL -> USDC)
    const swapIx1 = new TransactionInstruction({
      keys: [
        { pubkey: new PublicKey("83KtdsfcyB336kH8b3JRoWMLngc9q9MfAUcd8SdQegJn"), isSigner: false, isWritable: true }, // AMM
        { pubkey: new PublicKey("DRayqG9RXYi8WHgWEmRQGrUWRWbhjYWYkCRJDd6JBBak"), isSigner: false, isWritable: false }, // Authority
        { pubkey: new PublicKey("Cikw3ag5C5BRnj5MsnmfZNYHHpup669TjSxWT7JHdpc1"), isSigner: false, isWritable: true }, // Open orders
        { pubkey: new PublicKey("Dy2FMRoxdnQFxGQNXSgc3tY8db15MqdVmm5LJiUvcsFf"), isSigner: false, isWritable: true }, // Target orders
        { pubkey: new PublicKey("2meN5DuUivsc8GkSou5vDRXYEx41BfpT9GLLADwetuMD"), isSigner: false, isWritable: true }, // Base vault
        { pubkey: new PublicKey("sWDtX6Xv6aQETZuYeBwJi3VWf8b81j6vUXSjV58hapK"), isSigner: false, isWritable: true }, // Quote vault
        { pubkey: new PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj"), isSigner: false, isWritable: false }, // Market program
        { pubkey: new PublicKey("5gg4ovkjv8mRp9VVuexXhXmfN4JKqMZ9SuwCyasbLwVB"), isSigner: false, isWritable: true }, // Market
        { pubkey: wallet.publicKey, isSigner: false, isWritable: true }, // User source (SOL)
        { pubkey: wallet.publicKey, isSigner: false, isWritable: true }, // User dest (USDC)
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // User authority
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: new PublicKey("DRaya7Kj3aMWQSy19kSjvmuwq9docCHofyP9kanQGaav"),
      data: instructionData,
    });
    
    // Reverse swap instruction data (USDC -> SOL)
    let reverseData = Buffer.alloc(17);
    reverseData.writeUInt8(swapInstruction, 0);
    reverseData.writeBigUInt64LE(minAmountOut, 1); // Use received USDC
    reverseData.writeBigUInt64LE(BigInt(0.003 * LAMPORTS_PER_SOL), 9); // Min SOL out
    
    // Direct call to Raydium (USDC -> SOL)
    const swapIx2 = new TransactionInstruction({
      keys: [
        { pubkey: new PublicKey("83KtdsfcyB336kH8b3JRoWMLngc9q9MfAUcd8SdQegJn"), isSigner: false, isWritable: true }, // AMM
        { pubkey: new PublicKey("DRayqG9RXYi8WHgWEmRQGrUWRWbhjYWYkCRJDd6JBBak"), isSigner: false, isWritable: false }, // Authority
        { pubkey: new PublicKey("Cikw3ag5C5BRnj5MsnmfZNYHHpup669TjSxWT7JHdpc1"), isSigner: false, isWritable: true }, // Open orders
        { pubkey: new PublicKey("Dy2FMRoxdnQFxGQNXSgc3tY8db15MqdVmm5LJiUvcsFf"), isSigner: false, isWritable: true }, // Target orders
        { pubkey: new PublicKey("sWDtX6Xv6aQETZuYeBwJi3VWf8b81j6vUXSjV58hapK"), isSigner: false, isWritable: true }, // Quote vault (now source)
        { pubkey: new PublicKey("2meN5DuUivsc8GkSou5vDRXYEx41BfpT9GLLADwetuMD"), isSigner: false, isWritable: true }, // Base vault (now dest)
        { pubkey: new PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj"), isSigner: false, isWritable: false }, // Market program
        { pubkey: new PublicKey("5gg4ovkjv8mRp9VVuexXhXmfN4JKqMZ9SuwCyasbLwVB"), isSigner: false, isWritable: true }, // Market
        { pubkey: wallet.publicKey, isSigner: false, isWritable: true }, // User source (USDC)
        { pubkey: wallet.publicKey, isSigner: false, isWritable: true }, // User dest (SOL)
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // User authority
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: new PublicKey("DRaya7Kj3aMWQSy19kSjvmuwq9docCHofyP9kanQGaav"),
      data: reverseData,
    });
    
    // Create atomic transaction with both swaps
    const transaction = new Transaction()
      .add(swapIx1)  // SOL -> USDC
      .add(swapIx2); // USDC -> SOL
    
    console.log("📤 Sending atomic round-trip transaction...");
    
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: 'confirmed' }
    );
    
    console.log("\\n✅ Atomic round-trip swap successful!");
    console.log("Signature:", signature);
    console.log("View on Solscan:", `https://solscan.io/tx/${signature}?cluster=devnet`);
    
  } catch (error) {
    console.error("❌ Transaction failed:", error);
    
    if (error.logs) {
      console.log("\\n📋 Transaction logs:");
      error.logs.forEach((log, i) => console.log(`${i + 1}. ${log}`));
    }
  }
}

atomicSwapDirect();
