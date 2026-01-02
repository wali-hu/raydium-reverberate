import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  SystemProgram
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  NATIVE_MINT,
  createSyncNativeInstruction
} from "@solana/spl-token";
import * as dotenv from "dotenv";
import bs58 from "bs58";
import * as borsh from "borsh";

dotenv.config();

// Your deployed program ID
const ATOMIC_SWAP_PROGRAM_ID = new PublicKey("c6yDi5Z8AjensVGtu7WrsoL4T2XLVChLQo9t7MbYahg");
const DEVUSDC = new PublicKey("7yPDSToUbixNUmvRuEFFW4Q9omaqSUR192Xo4zuqGDSR");

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

class FinalVolumeBot {
  connection: Connection;
  wallet: Keypair;

  constructor() {
    this.connection = new Connection("https://api.devnet.solana.com", "confirmed");
    this.wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY!));
  }

  async createOwnPool() {
    console.log("Creating our own simple AMM pool...");
    
    // Create a simple pool account that our program owns
    const poolKeypair = Keypair.generate();
    
    const transaction = new Transaction();
    
    // Create pool account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: this.wallet.publicKey,
        newAccountPubkey: poolKeypair.publicKey,
        lamports: await this.connection.getMinimumBalanceForRentExemption(1000),
        space: 1000,
        programId: ATOMIC_SWAP_PROGRAM_ID, // Our program owns this account
      })
    );
    
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.wallet, poolKeypair],
      { commitment: "confirmed" }
    );
    
    console.log(`Pool created: ${poolKeypair.publicKey.toString()}`);
    console.log(`Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    return poolKeypair.publicKey;
  }

  async executeAtomicSwap(poolId: PublicKey, solAmount: number) {
    console.log(`Executing atomic swap with our pool: ${solAmount} SOL`);
    
    try {
      const amountIn = BigInt(solAmount * LAMPORTS_PER_SOL);
      const instructionData = new AtomicSwapInstruction({
        amount_in: amountIn,
        minimum_amount_out_buy: BigInt(1),
        minimum_amount_out_sell: BigInt(1)
      });
      
      const serializedData = borsh.serialize(AtomicSwapInstructionSchema, instructionData);
      
      const userSolAccount = await getAssociatedTokenAddress(NATIVE_MINT, this.wallet.publicKey);
      const userTokenAccount = await getAssociatedTokenAddress(DEVUSDC, this.wallet.publicKey);
      
      // Create instruction for our smart contract
      const atomicSwapIx = new TransactionInstruction({
        programId: ATOMIC_SWAP_PROGRAM_ID,
        keys: [
          { pubkey: ATOMIC_SWAP_PROGRAM_ID, isSigner: false, isWritable: false }, // Our program as "Raydium"
          { pubkey: poolId, isSigner: false, isWritable: true }, // Our pool
          { pubkey: this.wallet.publicKey, isSigner: false, isWritable: false }, // Authority
          { pubkey: poolId, isSigner: false, isWritable: true }, // Open orders
          { pubkey: poolId, isSigner: false, isWritable: true }, // Target orders
          { pubkey: userSolAccount, isSigner: false, isWritable: true }, // Base vault
          { pubkey: userTokenAccount, isSigner: false, isWritable: true }, // Quote vault
          { pubkey: ATOMIC_SWAP_PROGRAM_ID, isSigner: false, isWritable: false }, // Serum program
          { pubkey: poolId, isSigner: false, isWritable: true }, // Market
          { pubkey: poolId, isSigner: false, isWritable: true }, // Bids
          { pubkey: poolId, isSigner: false, isWritable: true }, // Asks
          { pubkey: poolId, isSigner: false, isWritable: true }, // Event queue
          { pubkey: userSolAccount, isSigner: false, isWritable: true }, // Coin vault
          { pubkey: userTokenAccount, isSigner: false, isWritable: true }, // PC vault
          { pubkey: this.wallet.publicKey, isSigner: false, isWritable: false }, // Vault signer
          { pubkey: userSolAccount, isSigner: false, isWritable: true }, // User source
          { pubkey: userTokenAccount, isSigner: false, isWritable: true }, // User dest
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false }, // User owner
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Token program
        ],
        data: Buffer.from(serializedData)
      });
      
      const transaction = new Transaction();
      
      // Create accounts if needed
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
      
      transaction.add(createSyncNativeInstruction(userSolAccount));
      transaction.add(atomicSwapIx);
      
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet],
        { commitment: "confirmed" }
      );
      
      console.log(`✅ Atomic swap completed: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      return { success: true, signature };
      
    } catch (error) {
      console.error("❌ Atomic swap failed:", error.message);
      return { success: false, error: error.message };
    }
  }

  async run() {
    console.log("🚀 Starting Final Volume Bot with Own Pool");
    console.log(`Wallet: ${this.wallet.publicKey.toString()}`);
    
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    console.log(`SOL Balance: ${balance / LAMPORTS_PER_SOL}`);
    
    // Create our own pool
    const poolId = await this.createOwnPool();
    
    // Execute atomic swaps
    const results = [];
    for (let i = 0; i < 3; i++) {
      console.log(`\n📊 Atomic swap ${i + 1}/3`);
      const result = await this.executeAtomicSwap(poolId, 0.01);
      results.push(result);
      
      if (i < 2) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const successful = results.filter(r => r.success).length;
    console.log(`\n📈 Results: ${successful}/3 successful (${(successful/3*100).toFixed(1)}%)`);
  }
}

async function main() {
  try {
    const bot = new FinalVolumeBot();
    await bot.run();
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
