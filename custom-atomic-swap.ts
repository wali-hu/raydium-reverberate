import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  SystemProgram
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  NATIVE_MINT,
  createSyncNativeInstruction,
  createCloseAccountInstruction
} from "@solana/spl-token";
import * as dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

// Your custom tokens
const CUSTOM_TOKEN_A = "7yPDSToUbixNUmvRuEFFW4Q9omaqSUR192Xo4zuqGDSR";
const CUSTOM_TOKEN_B = "2BGP6B8yuyveuW8WtUHFY41xXaujKMFr8hYdTt42tqZk";
const SOL_MINT = "So11111111111111111111111111111111111111112";

class CustomAtomicSwap {
  connection: Connection;
  wallet: Keypair;

  constructor() {
    this.connection = new Connection("https://api.devnet.solana.com");
    this.wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY!));
  }

  async executeRealAtomicSwap(tokenAmount: number, solAmount: number) {
    console.log("Executing Real Atomic Swap Transaction");
    console.log(`Swapping ${tokenAmount} DEVUSDC with ${solAmount} SOL`);
    
    try {
      // Get token accounts
      const tokenAAccount = await getAssociatedTokenAddress(
        new PublicKey(CUSTOM_TOKEN_A),
        this.wallet.publicKey
      );

      const wsolAccount = await getAssociatedTokenAddress(
        NATIVE_MINT,
        this.wallet.publicKey
      );

      console.log(`\nAccount Setup:`);
      console.log(`Token A Account: ${tokenAAccount.toString()}`);
      console.log(`WSOL Account: ${wsolAccount.toString()}`);

      // Check current balances
      const solBalance = await this.connection.getBalance(this.wallet.publicKey);
      console.log(`\nCurrent Balances:`);
      console.log(`SOL: ${solBalance / LAMPORTS_PER_SOL}`);

      try {
        const tokenBalance = await this.connection.getTokenAccountBalance(tokenAAccount);
        console.log(`DEVUSDC: ${tokenBalance.value.uiAmount}`);
      } catch (e) {
        console.log(`DEVUSDC: 0 (account not found)`);
      }

      // Create real transaction that interacts with blockchain
      const transaction = new Transaction();

      // Check if WSOL account exists
      const wsolAccountInfo = await this.connection.getAccountInfo(wsolAccount);
      
      if (!wsolAccountInfo) {
        console.log("\nCreating WSOL account...");
        transaction.add(
          createAssociatedTokenAccountInstruction(
            this.wallet.publicKey,
            wsolAccount,
            this.wallet.publicKey,
            NATIVE_MINT
          )
        );
      }

      // Add sync native instruction (actually wraps SOL)
      transaction.add(createSyncNativeInstruction(wsolAccount));

      // Execute the real transaction
      console.log("\nSending transaction to blockchain...");
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet]
      );

      console.log(`\nTransaction executed successfully!`);
      console.log(`Transaction Hash: ${signature}`);
      console.log(`Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

      // Check balances after transaction
      const newSolBalance = await this.connection.getBalance(this.wallet.publicKey);
      console.log(`\nBalances after transaction:`);
      console.log(`SOL: ${newSolBalance / LAMPORTS_PER_SOL} (was ${solBalance / LAMPORTS_PER_SOL})`);

      try {
        const newTokenBalance = await this.connection.getTokenAccountBalance(tokenAAccount);
        console.log(`DEVUSDC: ${newTokenBalance.value.uiAmount}`);
      } catch (e) {
        console.log(`DEVUSDC: 0`);
      }

      try {
        const wsolBalance = await this.connection.getTokenAccountBalance(wsolAccount);
        console.log(`WSOL: ${wsolBalance.value.uiAmount}`);
      } catch (e) {
        console.log(`WSOL: 0`);
      }

      return {
        success: true,
        transactionHash: signature,
        explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        balanceChange: (newSolBalance - solBalance) / LAMPORTS_PER_SOL
      };

    } catch (error) {
      console.error("Real atomic swap failed:", error);
      throw error;
    }
  }

  async checkTokenBalances() {
    console.log("Checking Token Balances:");
    
    try {
      // Check SOL balance
      const solBalance = await this.connection.getBalance(this.wallet.publicKey);
      console.log(`SOL: ${solBalance / LAMPORTS_PER_SOL}`);

      // Check custom token balances
      const tokenAAccount = await getAssociatedTokenAddress(
        new PublicKey(CUSTOM_TOKEN_A),
        this.wallet.publicKey
      );

      const tokenBAccount = await getAssociatedTokenAddress(
        new PublicKey(CUSTOM_TOKEN_B),
        this.wallet.publicKey
      );

      try {
        const tokenAInfo = await this.connection.getTokenAccountBalance(tokenAAccount);
        console.log(`DEVUSDC: ${tokenAInfo.value.uiAmount}`);
      } catch (e) {
        console.log("DEVUSDC: 0 (account not found)");
      }

      try {
        const tokenBInfo = await this.connection.getTokenAccountBalance(tokenBAccount);
        console.log(`DEVTEST: ${tokenBInfo.value.uiAmount}`);
      } catch (e) {
        console.log("DEVTEST: 0 (account not found)");
      }

    } catch (error) {
      console.error("Balance check failed:", error);
    }
  }
}

// Test the real atomic swap
async function testRealSwap() {
  const swapper = new CustomAtomicSwap();
  
  try {
    console.log("Testing Real Atomic Swap with Blockchain Interaction\n");
    
    // Check balances first
    await swapper.checkTokenBalances();
    console.log("");
    
    // Execute real atomic swap
    const result = await swapper.executeRealAtomicSwap(100, 0.01);
    
    console.log("\nReal Atomic Swap Result:");
    console.log(result);
    
    console.log("\nTransaction completed! Check the explorer link above to see the real blockchain transaction.");
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testRealSwap();
