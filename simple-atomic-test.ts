import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  NATIVE_MINT
} from "@solana/spl-token";
import * as dotenv from "dotenv";
import bs58 from "bs58";
import * as borsh from "borsh";

dotenv.config();

// Your deployed program ID
const ATOMIC_SWAP_PROGRAM_ID = new PublicKey("c6yDi5Z8AjensVGtu7WrsoL4T2XLVChLQo9t7MbYahg");

// Custom tokens
const DEVUSDC = new PublicKey("7yPDSToUbixNUmvRuEFFW4Q9omaqSUR192Xo4zuqGDSR");

// Correct Raydium devnet program IDs from docs
const RAYDIUM_LIQUIDITY_PROGRAM_ID = new PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8");
const SERUM_PROGRAM_ID = new PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj");

// Known devnet SOL/USDC pool (this is a real pool that exists)
const KNOWN_POOL_ID = new PublicKey("58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2");

class AtomicSwapInstruction {
  amount_in: bigint;
  minimum_amount_out_buy: bigint;
  minimum_amount_out_sell: bigint;

  constructor(fields: { amount_in: bigint; minimum_amount_out_buy: bigint; minimum_amount_out_sell: bigint }) {
    this.amount_in = fields.amount_in;
    this.minimum_amount_out_buy = fields.minimum_amount_out_buy;
    this.minimum_amount_out_sell = fields.minimum_amount_out_sell;
  }
}

const AtomicSwapInstructionSchema = new Map([
  [AtomicSwapInstruction, { 
    kind: 'struct', 
    fields: [
      ['amount_in', 'u64'],
      ['minimum_amount_out_buy', 'u64'],
      ['minimum_amount_out_sell', 'u64']
    ]
  }]
]);

class SimpleAtomicSwap {
  connection: Connection;
  wallet: Keypair;

  constructor() {
    this.connection = new Connection("https://api.devnet.solana.com", "confirmed");
    this.wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY!));
  }

  async executeAtomicSwap(solAmount: number) {
    console.log(`Executing atomic swap with ${solAmount} SOL`);
    
    try {
      const amountIn = BigInt(solAmount * LAMPORTS_PER_SOL);
      const minAmountOutBuy = BigInt(1);
      const minAmountOutSell = BigInt(1);
      
      // Create instruction data
      const instructionData = new AtomicSwapInstruction({
        amount_in: amountIn,
        minimum_amount_out_buy: minAmountOutBuy,
        minimum_amount_out_sell: minAmountOutSell
      });
      
      const serializedData = borsh.serialize(AtomicSwapInstructionSchema, instructionData);
      
      // Get user token accounts
      const userSolAccount = await getAssociatedTokenAddress(NATIVE_MINT, this.wallet.publicKey);
      const userTokenAccount = await getAssociatedTokenAddress(DEVUSDC, this.wallet.publicKey);
      
      // Use placeholder accounts for the pool structure
      // In a real implementation, you'd fetch these from the actual pool
      const poolAccounts = {
        ammId: KNOWN_POOL_ID,
        ammAuthority: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
        ammOpenOrders: new PublicKey("HRk9CMrpq7Jn9sh7mzxE8CChHG2dHZzDmHZn2ggF6vcA"),
        ammTargetOrders: new PublicKey("HRk9CMrpq7Jn9sh7mzxE8CChHG2dHZzDmHZn2ggF6vcA"),
        poolCoinTokenAccount: new PublicKey("HRk9CMrpq7Jn9sh7mzxE8CChHG2dHZzDmHZn2ggF6vcA"),
        poolPcTokenAccount: new PublicKey("HRk9CMrpq7Jn9sh7mzxE8CChHG2dHZzDmHZn2ggF6vcA"),
        serumMarket: new PublicKey("HRk9CMrpq7Jn9sh7mzxE8CChHG2dHZzDmHZn2ggF6vcA"),
        serumBids: new PublicKey("HRk9CMrpq7Jn9sh7mzxE8CChHG2dHZzDmHZn2ggF6vcA"),
        serumAsks: new PublicKey("HRk9CMrpq7Jn9sh7mzxE8CChHG2dHZzDmHZn2ggF6vcA"),
        serumEventQueue: new PublicKey("HRk9CMrpq7Jn9sh7mzxE8CChHG2dHZzDmHZn2ggF6vcA"),
        serumCoinVaultAccount: new PublicKey("HRk9CMrpq7Jn9sh7mzxE8CChHG2dHZzDmHZn2ggF6vcA"),
        serumPcVaultAccount: new PublicKey("HRk9CMrpq7Jn9sh7mzxE8CChHG2dHZzDmHZn2ggF6vcA"),
        serumVaultSigner: new PublicKey("HRk9CMrpq7Jn9sh7mzxE8CChHG2dHZzDmHZn2ggF6vcA"),
      };
      
      // Create atomic swap instruction
      const atomicSwapIx = new TransactionInstruction({
        programId: ATOMIC_SWAP_PROGRAM_ID,
        keys: [
          { pubkey: RAYDIUM_LIQUIDITY_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: poolAccounts.ammId, isSigner: false, isWritable: false },
          { pubkey: poolAccounts.ammAuthority, isSigner: false, isWritable: false },
          { pubkey: poolAccounts.ammOpenOrders, isSigner: false, isWritable: true },
          { pubkey: poolAccounts.ammTargetOrders, isSigner: false, isWritable: true },
          { pubkey: poolAccounts.poolCoinTokenAccount, isSigner: false, isWritable: true },
          { pubkey: poolAccounts.poolPcTokenAccount, isSigner: false, isWritable: true },
          { pubkey: SERUM_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: poolAccounts.serumMarket, isSigner: false, isWritable: true },
          { pubkey: poolAccounts.serumBids, isSigner: false, isWritable: true },
          { pubkey: poolAccounts.serumAsks, isSigner: false, isWritable: true },
          { pubkey: poolAccounts.serumEventQueue, isSigner: false, isWritable: true },
          { pubkey: poolAccounts.serumCoinVaultAccount, isSigner: false, isWritable: true },
          { pubkey: poolAccounts.serumPcVaultAccount, isSigner: false, isWritable: true },
          { pubkey: poolAccounts.serumVaultSigner, isSigner: false, isWritable: false },
          { pubkey: userSolAccount, isSigner: false, isWritable: true },
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(serializedData)
      });
      
      const transaction = new Transaction();
      
      // Create token accounts if needed
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
      
      transaction.add(atomicSwapIx);
      
      console.log("Sending atomic swap transaction...");
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet],
        { commitment: "confirmed" }
      );
      
      console.log("Atomic swap completed!");
      console.log(`Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      
      return signature;
      
    } catch (error) {
      console.error("Atomic swap failed:", error);
      throw error;
    }
  }

  async run() {
    console.log("Starting Simple Atomic Swap Test");
    console.log(`Wallet: ${this.wallet.publicKey.toString()}`);
    console.log(`Program: ${ATOMIC_SWAP_PROGRAM_ID.toString()}`);
    
    // Check balance
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    console.log(`SOL Balance: ${balance / LAMPORTS_PER_SOL}`);
    
    if (balance < 0.1 * LAMPORTS_PER_SOL) {
      throw new Error("Insufficient SOL balance. Need at least 0.1 SOL for testing.");
    }
    
    // Execute atomic swap
    await this.executeAtomicSwap(0.01);
    
    console.log("Test completed!");
  }
}

// Run the test
async function main() {
  try {
    const swapper = new SimpleAtomicSwap();
    await swapper.run();
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
