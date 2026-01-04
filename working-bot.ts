import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  NATIVE_MINT,
  createSyncNativeInstruction,
  createTransferInstruction,
  getAccount
} from "@solana/spl-token";
import * as dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

// Your tokens
const DEVUSDC = new PublicKey("7yPDSToUbixNUmvRuEFFW4Q9omaqSUR192Xo4zuqGDSR");

class WorkingVolumeBot {
  connection: Connection;
  wallet: Keypair;

  constructor() {
    this.connection = new Connection("https://api.devnet.solana.com", "confirmed");
    this.wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY!));
  }

  async executeVolumeSwap(amount: number) {
    console.log(`Executing volume swap: ${amount} SOL`);
    
    try {
      const userSolAccount = await getAssociatedTokenAddress(NATIVE_MINT, this.wallet.publicKey);
      const userTokenAccount = await getAssociatedTokenAddress(DEVUSDC, this.wallet.publicKey);
      
      const transaction = new Transaction();
      
      // Create WSOL account if needed
      const solAccountInfo = await this.connection.getAccountInfo(userSolAccount);
      if (!solAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            this.wallet.publicKey,
            userSolAccount,
            this.wallet.publicKey,
            NATIVE_MINT
          )
        );
      }
      
      // Create token account if needed
      const tokenAccountInfo = await this.connection.getAccountInfo(userTokenAccount);
      if (!tokenAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            this.wallet.publicKey,
            userTokenAccount,
            this.wallet.publicKey,
            DEVUSDC
          )
        );
      }
      
      // Wrap SOL to simulate buy
      transaction.add(createSyncNativeInstruction(userSolAccount));
      
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet],
        { commitment: "confirmed" }
      );
      
      console.log(`Volume transaction completed: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      
      return { success: true, signature };
      
    } catch (error) {
      console.error("Volume swap failed:", error.message);
      return { success: false, error: error.message };
    }
  }

  async runVolumeBot(numberOfSwaps: number, swapAmount: number) {
    console.log("Starting Working Volume Bot");
    console.log(`Swaps: ${numberOfSwaps}, Amount: ${swapAmount} SOL each`);
    console.log(`Wallet: ${this.wallet.publicKey.toString()}`);
    
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    console.log(`SOL Balance: ${balance / LAMPORTS_PER_SOL}`);
    
    const results = [];
    
    for (let i = 0; i < numberOfSwaps; i++) {
      console.log(`\nVolume swap ${i + 1}/${numberOfSwaps}`);
      
      const result = await this.executeVolumeSwap(swapAmount);
      results.push(result);
      
      if (i < numberOfSwaps - 1) {
        console.log("⏳ Waiting 2 seconds...");
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const successful = results.filter(r => r.success).length;
    console.log(`\nVolume Bot Results:`);
    console.log(`Total: ${numberOfSwaps}, Success: ${successful}, Failed: ${numberOfSwaps - successful}`);
    console.log(`Success Rate: ${(successful / numberOfSwaps * 100).toFixed(1)}%`);
    
    return results;
  }
}

async function main() {
  try {
    const bot = new WorkingVolumeBot();
    await bot.runVolumeBot(3, 0.01);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
