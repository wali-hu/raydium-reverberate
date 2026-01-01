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
import * as borsh from "borsh";
import * as dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

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

async function executeAtomicSwap() {
  try {
    console.log("🚀 Executing Atomic Round-Trip Swap on Devnet");
    
    // Setup
    const connection = new Connection("https://api.devnet.solana.com", 'confirmed');
    const privateKeyBytes = bs58.decode(process.env.PRIVATE_KEY!);
    const wallet = Keypair.fromSecretKey(privateKeyBytes);
    const programId = new PublicKey("c6yDi5Z8AjensVGtu7WrsoL4T2XLVChLQo9t7MbYahg");
    
    // Pool and token addresses (from our decoded data)
    const RAYDIUM_PROGRAM = new PublicKey("DRaya7Kj3aMWQSy19kSjvmuwq9docCHofyP9kanQGaav");
    const POOL_ID = new PublicKey("83KtdsfcyB336kH8b3JRoWMLngc9q9MfAUcd8SdQegJn");
    const AMM_AUTHORITY = new PublicKey("DRayqG9RXYi8WHgWEmRQGrUWRWbhjYWYkCRJDd6JBBak"); // Real authority
    const BASE_VAULT = new PublicKey("2meN5DuUivsc8GkSou5vDRXYEx41BfpT9GLLADwetuMD");
    const QUOTE_VAULT = new PublicKey("sWDtX6Xv6aQETZuYeBwJi3VWf8b81j6vUXSjV58hapK");
    const OPEN_ORDERS = new PublicKey("Cikw3ag5C5BRnj5MsnmfZNYHHpup669TjSxWT7JHdpc1");
    const TARGET_ORDERS = new PublicKey("Dy2FMRoxdnQFxGQNXSgc3tY8db15MqdVmm5LJiUvcsFf");
    const MARKET_ID = new PublicKey("5gg4ovkjv8mRp9VVuexXhXmfN4JKqMZ9SuwCyasbLwVB");
    const MARKET_PROGRAM = new PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj");
    
    // Check balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log("Wallet Balance:", balance / LAMPORTS_PER_SOL, "SOL");
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      console.log("❌ Insufficient SOL balance");
      return;
    }
    
    // Swap parameters
    const amountInLamports = BigInt(0.005 * LAMPORTS_PER_SOL); // 0.005 SOL
    const slippageBps = 500; // 5%
    const minAmountOut = amountInLamports * BigInt(10000 - slippageBps) / BigInt(10000);
    
    console.log("\\n🔄 Executing atomic round-trip swap...");
    console.log("Amount:", 0.005, "SOL");
    console.log("Slippage:", slippageBps / 100, "%");
    
    // Create instruction data
    const instructionData = new AtomicSwapInstruction(
      amountInLamports,
      minAmountOut,
      minAmountOut
    );
    
    const serializedData = borsh.serialize(schema, instructionData);
    
    // Create instruction with minimal required accounts
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: RAYDIUM_PROGRAM, isSigner: false, isWritable: false },
        { pubkey: POOL_ID, isSigner: false, isWritable: true },
        { pubkey: AMM_AUTHORITY, isSigner: false, isWritable: false }, // Real authority
        { pubkey: OPEN_ORDERS, isSigner: false, isWritable: true },
        { pubkey: TARGET_ORDERS, isSigner: false, isWritable: true },
        { pubkey: BASE_VAULT, isSigner: false, isWritable: true },
        { pubkey: QUOTE_VAULT, isSigner: false, isWritable: true },
        { pubkey: MARKET_PROGRAM, isSigner: false, isWritable: false },
        { pubkey: MARKET_ID, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: false, isWritable: true }, // bids placeholder
        { pubkey: wallet.publicKey, isSigner: false, isWritable: true }, // asks placeholder
        { pubkey: wallet.publicKey, isSigner: false, isWritable: true }, // event queue placeholder
        { pubkey: wallet.publicKey, isSigner: false, isWritable: true }, // coin vault placeholder
        { pubkey: wallet.publicKey, isSigner: false, isWritable: true }, // pc vault placeholder
        { pubkey: wallet.publicKey, isSigner: false, isWritable: false }, // vault signer placeholder
        { pubkey: wallet.publicKey, isSigner: false, isWritable: true }, // user source
        { pubkey: wallet.publicKey, isSigner: false, isWritable: true }, // user dest
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // user authority
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: programId,
      data: Buffer.from(serializedData),
    });
    
    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    
    console.log("📤 Sending transaction...");
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

executeAtomicSwap();
