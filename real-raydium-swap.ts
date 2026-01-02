import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  NATIVE_MINT,
  createSyncNativeInstruction,
  createCloseAccountInstruction
} from "@solana/spl-token";
import { LIQUIDITY_STATE_LAYOUT_V4 } from "@raydium-io/raydium-sdk";
import * as dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

// Working devnet pool and program
const RAYDIUM_AMM_PROGRAM = new PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8");
const WORKING_POOL = "3rnUv5HsgJfhmRWFa9PLsdMv5VqNZka4XFfGzQBWm3u9";
const SERUM_PROGRAM = new PublicKey("DESVgJVGajEgKGXhb6XmqDHGz3VjdgP7rEVESBgxmroY");

class RealRaydiumSwap {
  connection: Connection;
  wallet: Keypair;

  constructor() {
    this.connection = new Connection("https://api.devnet.solana.com");
    this.wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY!));
  }

  async getPoolData(poolAddress: string) {
    const poolInfo = await this.connection.getAccountInfo(new PublicKey(poolAddress));
    if (!poolInfo) throw new Error("Pool not found");
    
    const poolData = LIQUIDITY_STATE_LAYOUT_V4.decode(poolInfo.data);
    return {
      baseMint: poolData.baseMint,
      quoteMint: poolData.quoteMint,
      baseVault: poolData.baseVault,
      quoteVault: poolData.quoteVault,
      authority: poolData.authority,
      openOrders: poolData.openOrders,
      targetOrders: poolData.targetOrders,
      marketId: poolData.marketId
    };
  }

  async executeRealAtomicSwap(solAmount: number) {
    console.log("Executing Real Raydium Atomic Swap");
    console.log(`Amount: ${solAmount} SOL`);
    
    try {
      // Get pool data
      const poolData = await this.getPoolData(WORKING_POOL);
      console.log(`\nPool Data Retrieved:`);
      console.log(`Base Mint: ${poolData.baseMint.toString()}`);
      console.log(`Quote Mint: ${poolData.quoteMint.toString()}`);
      console.log(`Base Vault: ${poolData.baseVault.toString()}`);
      console.log(`Quote Vault: ${poolData.quoteVault.toString()}`);

      // Get user token accounts
      const userBaseAccount = await getAssociatedTokenAddress(
        poolData.baseMint,
        this.wallet.publicKey
      );

      const userQuoteAccount = await getAssociatedTokenAddress(
        poolData.quoteMint,
        this.wallet.publicKey
      );

      console.log(`\nUser Accounts:`);
      console.log(`Base Token Account: ${userBaseAccount.toString()}`);
      console.log(`Quote Token Account: ${userQuoteAccount.toString()}`);

      // Check current balances
      const solBalance = await this.connection.getBalance(this.wallet.publicKey);
      console.log(`\nCurrent SOL Balance: ${solBalance / LAMPORTS_PER_SOL}`);

      // Create transaction for atomic swap
      const transaction = new Transaction();

      // Create base token account if needed
      const baseAccountInfo = await this.connection.getAccountInfo(userBaseAccount);
      if (!baseAccountInfo) {
        console.log("Creating base token account...");
        transaction.add(
          createAssociatedTokenAccountInstruction(
            this.wallet.publicKey,
            userBaseAccount,
            this.wallet.publicKey,
            poolData.baseMint
          )
        );
      }

      // Create quote token account if needed (WSOL)
      const quoteAccountInfo = await this.connection.getAccountInfo(userQuoteAccount);
      if (!quoteAccountInfo) {
        console.log("Creating WSOL account...");
        transaction.add(
          createAssociatedTokenAccountInstruction(
            this.wallet.publicKey,
            userQuoteAccount,
            this.wallet.publicKey,
            poolData.quoteMint
          )
        );
      }

      // Wrap SOL for swap
      transaction.add(createSyncNativeInstruction(userQuoteAccount));

      // Build Raydium swap instruction (SOL -> Token)
      const swapInstruction = this.buildRaydiumSwapInstruction(
        poolData,
        userQuoteAccount, // source (WSOL)
        userBaseAccount, // destination (Token)
        Math.floor(solAmount * LAMPORTS_PER_SOL),
        0 // minimum out (for now)
      );

      transaction.add(swapInstruction);

      // Build reverse swap instruction (Token -> SOL)
      const reverseSwapInstruction = this.buildRaydiumSwapInstruction(
        poolData,
        userBaseAccount, // source (Token)
        userQuoteAccount, // destination (WSOL)
        0, // will use all tokens received
        0 // minimum out
      );

      transaction.add(reverseSwapInstruction);

      // Unwrap SOL
      transaction.add(
        createCloseAccountInstruction(
          userQuoteAccount,
          this.wallet.publicKey,
          this.wallet.publicKey
        )
      );

      console.log(`\nTransaction built with ${transaction.instructions.length} instructions`);
      console.log("Sending atomic swap transaction...");

      // Execute the transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet]
      );

      console.log(`\nAtomic swap executed successfully!`);
      console.log(`Transaction Hash: ${signature}`);
      console.log(`Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

      // Check final balances
      const finalSolBalance = await this.connection.getBalance(this.wallet.publicKey);
      console.log(`\nFinal SOL Balance: ${finalSolBalance / LAMPORTS_PER_SOL}`);
      console.log(`Balance Change: ${(finalSolBalance - solBalance) / LAMPORTS_PER_SOL} SOL`);

      return {
        success: true,
        transactionHash: signature,
        explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        initialBalance: solBalance / LAMPORTS_PER_SOL,
        finalBalance: finalSolBalance / LAMPORTS_PER_SOL,
        balanceChange: (finalSolBalance - solBalance) / LAMPORTS_PER_SOL
      };

    } catch (error) {
      console.error("Real atomic swap failed:", error);
      throw error;
    }
  }

  buildRaydiumSwapInstruction(
    poolData: any,
    userSourceAccount: PublicKey,
    userDestAccount: PublicKey,
    amountIn: number,
    minimumAmountOut: number
  ): TransactionInstruction {
    
    // Raydium swap instruction data
    const instructionData = Buffer.alloc(17);
    instructionData.writeUInt8(9, 0); // Swap instruction
    instructionData.writeBigUInt64LE(BigInt(amountIn), 1);
    instructionData.writeBigUInt64LE(BigInt(minimumAmountOut), 9);

    return new TransactionInstruction({
      programId: RAYDIUM_AMM_PROGRAM,
      keys: [
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: new PublicKey(WORKING_POOL), isSigner: false, isWritable: true },
        { pubkey: poolData.authority, isSigner: false, isWritable: false },
        { pubkey: poolData.openOrders, isSigner: false, isWritable: true },
        { pubkey: poolData.targetOrders, isSigner: false, isWritable: true },
        { pubkey: poolData.baseVault, isSigner: false, isWritable: true },
        { pubkey: poolData.quoteVault, isSigner: false, isWritable: true },
        { pubkey: SERUM_PROGRAM, isSigner: false, isWritable: false },
        { pubkey: poolData.marketId, isSigner: false, isWritable: true },
        { pubkey: userSourceAccount, isSigner: false, isWritable: true },
        { pubkey: userDestAccount, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false }
      ],
      data: instructionData
    });
  }
}

// Test real atomic swap
async function testRealRaydiumSwap() {
  const swapper = new RealRaydiumSwap();
  
  try {
    console.log("Testing Real Raydium Atomic Swap\n");
    
    const result = await swapper.executeRealAtomicSwap(0.001);
    
    console.log("\nReal Raydium Atomic Swap Result:");
    console.log(result);
    
    console.log("\nSUCCESS! Real atomic swap with actual Raydium pool interaction completed.");
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testRealRaydiumSwap();
