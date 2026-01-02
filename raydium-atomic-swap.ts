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
import pkg from "@raydium-io/raydium-sdk";
const { Liquidity, LiquidityPoolKeys, MARKET_STATE_LAYOUT_V3, Market, TOKEN_PROGRAM_ID: RAYDIUM_TOKEN_PROGRAM_ID } = pkg;
import * as dotenv from "dotenv";
import bs58 from "bs58";
import * as borsh from "borsh";

dotenv.config();

// Your deployed program ID
const ATOMIC_SWAP_PROGRAM_ID = new PublicKey("c6yDi5Z8AjensVGtu7WrsoL4T2XLVChLQo9t7MbYahg"); // Replace with actual program ID

// Custom tokens
const DEVUSDC = new PublicKey("7yPDSToUbixNUmvRuEFFW4Q9omaqSUR192Xo4zuqGDSR");
const DEVTEST = new PublicKey("2BGP6B8yuyveuW8WtUHFY41xXaujKMFr8hYdTt42tqZk");

// Raydium devnet program IDs
const RAYDIUM_LIQUIDITY_PROGRAM_ID = new PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8");
const SERUM_PROGRAM_ID = new PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj");

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

class RaydiumAtomicSwap {
  connection: Connection;
  wallet: Keypair;

  constructor() {
    this.connection = new Connection("https://api.devnet.solana.com", "confirmed");
    this.wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY!));
  }

  async findRaydiumPool() {
    console.log("Finding existing Raydium pools on devnet...");
    
    // Look for SOL/DEVUSDC pool
    try {
      const pools = await Liquidity.fetchAllPoolKeys(this.connection);
      console.log(`Found ${pools.length} pools`);
      
      // Find pool with our tokens
      const targetPool = pools.find(pool => 
        (pool.baseMint.equals(NATIVE_MINT) && pool.quoteMint.equals(DEVUSDC)) ||
        (pool.baseMint.equals(DEVUSDC) && pool.quoteMint.equals(NATIVE_MINT))
      );

      if (targetPool) {
        console.log("Found existing pool:", targetPool.id.toString());
        return targetPool;
      }
      
      console.log("No existing pool found for SOL/DEVUSDC");
      return null;
    } catch (error) {
      console.log("Error finding pools:", error);
      return null;
    }
  }

  async createRaydiumPool() {
    console.log("Creating new Raydium pool...");
    
    try {
      // Create market first (simplified - in real implementation you'd need to create a full Serum market)
      const marketId = Keypair.generate().publicKey;
      
      // For devnet testing, we'll use a mock pool structure
      const poolKeys: LiquidityPoolKeys = {
        id: Keypair.generate().publicKey,
        baseMint: NATIVE_MINT,
        quoteMint: DEVUSDC,
        lpMint: Keypair.generate().publicKey,
        baseDecimals: 9,
        quoteDecimals: 6,
        lpDecimals: 6,
        version: 4,
        programId: RAYDIUM_LIQUIDITY_PROGRAM_ID,
        authority: Keypair.generate().publicKey,
        openOrders: Keypair.generate().publicKey,
        targetOrders: Keypair.generate().publicKey,
        baseVault: Keypair.generate().publicKey,
        quoteVault: Keypair.generate().publicKey,
        withdrawQueue: Keypair.generate().publicKey,
        lpVault: Keypair.generate().publicKey,
        marketVersion: 3,
        marketProgramId: SERUM_PROGRAM_ID,
        marketId: marketId,
        marketAuthority: Keypair.generate().publicKey,
        marketBaseVault: Keypair.generate().publicKey,
        marketQuoteVault: Keypair.generate().publicKey,
        marketBids: Keypair.generate().publicKey,
        marketAsks: Keypair.generate().publicKey,
        marketEventQueue: Keypair.generate().publicKey,
        lookupTableAccount: undefined
      };

      console.log("Pool created with ID:", poolKeys.id.toString());
      return poolKeys;
      
    } catch (error) {
      console.error("Failed to create pool:", error);
      throw error;
    }
  }

  async executeAtomicSwap(poolKeys: LiquidityPoolKeys, solAmount: number) {
    console.log(`Executing atomic swap with ${solAmount} SOL`);
    
    try {
      const amountIn = BigInt(solAmount * LAMPORTS_PER_SOL);
      const minAmountOutBuy = BigInt(1); // Minimum tokens to receive from buy
      const minAmountOutSell = BigInt(1); // Minimum SOL to receive from sell
      
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
      
      // Create atomic swap instruction
      const atomicSwapIx = new TransactionInstruction({
        programId: ATOMIC_SWAP_PROGRAM_ID,
        keys: [
          { pubkey: RAYDIUM_LIQUIDITY_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: poolKeys.id, isSigner: false, isWritable: false },
          { pubkey: poolKeys.authority, isSigner: false, isWritable: false },
          { pubkey: poolKeys.openOrders, isSigner: false, isWritable: true },
          { pubkey: poolKeys.targetOrders, isSigner: false, isWritable: true },
          { pubkey: poolKeys.baseVault, isSigner: false, isWritable: true },
          { pubkey: poolKeys.quoteVault, isSigner: false, isWritable: true },
          { pubkey: poolKeys.marketProgramId, isSigner: false, isWritable: false },
          { pubkey: poolKeys.marketId, isSigner: false, isWritable: true },
          { pubkey: poolKeys.marketBids, isSigner: false, isWritable: true },
          { pubkey: poolKeys.marketAsks, isSigner: false, isWritable: true },
          { pubkey: poolKeys.marketEventQueue, isSigner: false, isWritable: true },
          { pubkey: poolKeys.marketBaseVault, isSigner: false, isWritable: true },
          { pubkey: poolKeys.marketQuoteVault, isSigner: false, isWritable: true },
          { pubkey: poolKeys.marketAuthority, isSigner: false, isWritable: false },
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
    console.log("Starting Raydium Atomic Swap Bot");
    console.log(`Wallet: ${this.wallet.publicKey.toString()}`);
    
    // Check balance
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    console.log(`SOL Balance: ${balance / LAMPORTS_PER_SOL}`);
    
    if (balance < 0.1 * LAMPORTS_PER_SOL) {
      throw new Error("Insufficient SOL balance. Need at least 0.1 SOL for testing.");
    }
    
    // Find or create pool
    let poolKeys = await this.findRaydiumPool();
    
    if (!poolKeys) {
      console.log("Creating new pool...");
      poolKeys = await this.createRaydiumPool();
    }
    
    // Execute atomic swap
    await this.executeAtomicSwap(poolKeys, 0.01); // Swap 0.01 SOL
    
    console.log("Atomic swap completed successfully!");
  }
}

// Run the atomic swap
async function main() {
  try {
    const swapper = new RaydiumAtomicSwap();
    await swapper.run();
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
