import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  TransactionInstruction,
  sendAndConfirmTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction,
  NATIVE_MINT
} from "@solana/spl-token";
import { LIQUIDITY_STATE_LAYOUT_V4 } from "@raydium-io/raydium-sdk";
import * as borsh from "borsh";
import * as dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

// Raydium AMM Program ID (devnet)
const RAYDIUM_AMM_PROGRAM = new PublicKey("DRaya7Kj3aMWQSy19kSjvmuwq9docCHofyP9kanQGaav");

class AtomicSwapInstruction {
  amount_in: bigint;
  minimum_amount_out_buy: bigint;
  minimum_amount_out_sell: bigint;

  constructor(amount_in: bigint, minimum_amount_out_buy: bigint, minimum_amount_out_sell: bigint) {
    this.amount_in = amount_in;
    this.minimum_amount_out_buy = minimum_amount_out_buy;
    this.minimum_amount_out_sell = minimum_amount_out_sell;
  }
}

const schema = new Map([
  [AtomicSwapInstruction, {
    kind: 'struct',
    fields: [
      ['amount_in', 'u64'],
      ['minimum_amount_out_buy', 'u64'],
      ['minimum_amount_out_sell', 'u64'],
    ],
  }],
]);

export class AtomicSwapClient {
  private connection: Connection;
  private wallet: Keypair;
  private programId: PublicKey;

  constructor(programId: string) {
    this.connection = new Connection(
      process.env.RPC_URL || "https://api.devnet.solana.com",
      {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      }
    );
    
    // Convert base58 private key to Uint8Array
    const privateKeyBytes = bs58.decode(process.env.PRIVATE_KEY!);
    this.wallet = Keypair.fromSecretKey(privateKeyBytes);
    
    this.programId = new PublicKey(programId);
  }

  async executeRoundTrip(
    poolId: string,
    tokenMint: string,
    amountInSol: number,
    slippageBps: number = 500
  ) {
    const poolPubkey = new PublicKey(poolId);
    const tokenMintPubkey = new PublicKey(tokenMint);
    
    // Get pool info (mock for devnet testing)
    const poolInfo = await this.getPoolInfo(poolPubkey);
    
    // Get user token accounts
    const userSolAccount = await getAssociatedTokenAddress(
      NATIVE_MINT, // WSOL
      this.wallet.publicKey
    );
    
    const userTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      this.wallet.publicKey
    );

    // Calculate amounts
    const amountInLamports = BigInt(amountInSol * LAMPORTS_PER_SOL);
    const minAmountOutBuy = amountInLamports * BigInt(10000 - slippageBps) / BigInt(10000);
    const minAmountOutSell = amountInLamports * BigInt(10000 - slippageBps) / BigInt(10000);

    // Create instruction data
    const instructionData = new AtomicSwapInstruction(
      amountInLamports,
      minAmountOutBuy,
      minAmountOutSell
    );

    const serializedData = borsh.serialize(schema, instructionData);

    // Create instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: RAYDIUM_AMM_PROGRAM, isSigner: false, isWritable: false },
        { pubkey: poolInfo.ammId, isSigner: false, isWritable: true },
        { pubkey: poolInfo.ammAuthority, isSigner: false, isWritable: false },
        { pubkey: poolInfo.ammOpenOrders, isSigner: false, isWritable: true },
        { pubkey: poolInfo.ammTargetOrders, isSigner: false, isWritable: true },
        { pubkey: poolInfo.poolCoinTokenAccount, isSigner: false, isWritable: true },
        { pubkey: poolInfo.poolPcTokenAccount, isSigner: false, isWritable: true },
        { pubkey: poolInfo.serumProgramId, isSigner: false, isWritable: false },
        { pubkey: poolInfo.serumMarket, isSigner: false, isWritable: true },
        { pubkey: poolInfo.serumBids, isSigner: false, isWritable: true },
        { pubkey: poolInfo.serumAsks, isSigner: false, isWritable: true },
        { pubkey: poolInfo.serumEventQueue, isSigner: false, isWritable: true },
        { pubkey: poolInfo.serumCoinVaultAccount, isSigner: false, isWritable: true },
        { pubkey: poolInfo.serumPcVaultAccount, isSigner: false, isWritable: true },
        { pubkey: poolInfo.serumVaultSigner, isSigner: false, isWritable: false },
        { pubkey: userSolAccount, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from(serializedData),
    });

    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    
    try {
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet],
        { commitment: 'confirmed' }
      );

      console.log("Atomic round-trip transaction signature:", signature);
      return signature;
    } catch (error) {
      console.error("Transaction failed:", error);
      throw error;
    }
  }

  private async getPoolInfo(poolId: PublicKey) {
    try {
      // Fetch real pool account data from devnet
      const poolAccountInfo = await this.connection.getAccountInfo(poolId);
      
      if (!poolAccountInfo) {
        throw new Error("Pool not found on devnet");
      }
      
      console.log("✅ Pool found on devnet");
      
      // Decode the pool data using Raydium SDK
      const poolData = LIQUIDITY_STATE_LAYOUT_V4.decode(poolAccountInfo.data);
      
      console.log("📊 Decoded pool data:");
      console.log("Base Mint:", poolData.baseMint.toString());
      console.log("Quote Mint:", poolData.quoteMint.toString());
      console.log("Base Vault:", poolData.baseVault?.toString());
      console.log("Quote Vault:", poolData.quoteVault?.toString());
      
      return {
        ammId: poolId,
        ammAuthority: new PublicKey("DRayqG9RXYi8WHgWEmRQGrUWRWbhjYWYkCRJDd6JBBak"), // Real authority from pool data
        ammOpenOrders: poolData.openOrders || new PublicKey("Cikw3ag5C5BRnj5MsnmfZNYHHpup669TjSxWT7JHdpc1"),
        ammTargetOrders: poolData.targetOrders || new PublicKey("Dy2FMRoxdnQFxGQNXSgc3tY8db15MqdVmm5LJiUvcsFf"),
        poolCoinTokenAccount: poolData.baseVault || new PublicKey("2meN5DuUivsc8GkSou5vDRXYEx41BfpT9GLLADwetuMD"),
        poolPcTokenAccount: poolData.quoteVault || new PublicKey("sWDtX6Xv6aQETZuYeBwJi3VWf8b81j6vUXSjV58hapK"),
        serumProgramId: poolData.marketProgramId || new PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj"),
        serumMarket: poolData.marketId || new PublicKey("5gg4ovkjv8mRp9VVuexXhXmfN4JKqMZ9SuwCyasbLwVB"),
        serumBids: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"), // Will need to fetch from market
        serumAsks: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"), // Will need to fetch from market
        serumEventQueue: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"), // Will need to fetch from market
        serumCoinVaultAccount: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"), // Will need to fetch from market
        serumPcVaultAccount: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"), // Will need to fetch from market
        serumVaultSigner: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"), // Will need to fetch from market
      };
    } catch (error) {
      console.error("Failed to fetch pool info:", error);
      throw error;
    }
  }
}

// Usage function
export async function executeAtomicSwap(
  programId: string,
  poolId: string,
  tokenMint: string,
  amountInSol: number,
  slippageBps: number = 500
) {
  const client = new AtomicSwapClient(programId);
  return await client.executeRoundTrip(poolId, tokenMint, amountInSol, slippageBps);
}

// Execute real devnet transaction
async function executeDevnetSwap() {
  try {
    console.log("🚀 Executing Atomic Round-Trip Swap on Devnet");
    
    // Devnet pool and token addresses
    const POOL_ADDRESS = "83KtdsfcyB336kH8b3JRoWMLngc9q9MfAUcd8SdQegJn";
    const TOKEN_ADDRESS = "USDCoctVLVnvTXBEuP9s8hntucdJokbo17RwHuNXemT";
    const PROGRAM_ID = "c6yDi5Z8AjensVGtu7WrsoL4T2XLVChLQo9t7MbYahg";
    
    const client = new AtomicSwapClient(PROGRAM_ID);
    
    // Check wallet balance
    const balance = await client.connection.getBalance(client.wallet.publicKey);
    console.log("Wallet Balance:", balance / LAMPORTS_PER_SOL, "SOL");
    console.log("Wallet Address:", client.wallet.publicKey.toString());
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      console.log("❌ Insufficient SOL balance for swap");
      return;
    }
    
    console.log("\n📊 Pool Info:");
    console.log("Pool Address:", POOL_ADDRESS);
    console.log("Token Address:", TOKEN_ADDRESS);
    
    console.log("\n🔄 Executing atomic round-trip swap...");
    console.log("Amount: 0.005 SOL");
    console.log("Slippage: 5%");
    
    // Execute the swap
    const signature = await client.executeRoundTrip(
      POOL_ADDRESS,
      TOKEN_ADDRESS,
      0.005, // 0.005 SOL
      500    // 5% slippage
    );
    
    console.log("\n✅ Transaction successful!");
    console.log("Signature:", signature);
    console.log("View on Solscan:", `https://solscan.io/tx/${signature}?cluster=devnet`);
    
  } catch (error) {
    console.error("❌ Transaction failed:", error);
    
    if (error.message?.includes("insufficient funds")) {
      console.log("💡 Make sure you have enough SOL in your devnet wallet");
    } else if (error.message?.includes("pool")) {
      console.log("💡 Pool might not have sufficient liquidity or be inactive");
    }
  }
}

// Run devnet swap
executeDevnetSwap();
