import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  NATIVE_MINT
} from "@solana/spl-token";
import { 
  Liquidity,
  LiquidityPoolKeys,
  jsonInfo2PoolKeys,
  TokenAmount,
  Token,
  Percent
} from "@raydium-io/raydium-sdk";
import * as dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

async function directAtomicSwap() {
  try {
    console.log("🚀 Direct Atomic Round-Trip Swap on Devnet");
    
    const connection = new Connection("https://api.devnet.solana.com", 'confirmed');
    const privateKeyBytes = bs58.decode(process.env.PRIVATE_KEY!);
    const wallet = Keypair.fromSecretKey(privateKeyBytes);
    
    console.log("Wallet:", wallet.publicKey.toString());
    
    // Pool keys for the devnet pool
    const poolKeys: LiquidityPoolKeys = {
      id: new PublicKey("83KtdsfcyB336kH8b3JRoWMLngc9q9MfAUcd8SdQegJn"),
      baseMint: new PublicKey("So11111111111111111111111111111111111111112"), // SOL
      quoteMint: new PublicKey("USDCoctVLVnvTXBEuP9s8hntucdJokbo17RwHuNXemT"), // USDC
      lpMint: new PublicKey("GqEFD2FS2eFjDyR4B3enMhqQ7U6KstHmQyGHL765x41Y"),
      baseDecimals: 9,
      quoteDecimals: 6,
      lpDecimals: 6,
      version: 4,
      programId: new PublicKey("DRaya7Kj3aMWQSy19kSjvmuwq9docCHofyP9kanQGaav"),
      authority: new PublicKey("DRayqG9RXYi8WHgWEmRQGrUWRWbhjYWYkCRJDd6JBBak"),
      openOrders: new PublicKey("Cikw3ag5C5BRnj5MsnmfZNYHHpup669TjSxWT7JHdpc1"),
      targetOrders: new PublicKey("Dy2FMRoxdnQFxGQNXSgc3tY8db15MqdVmm5LJiUvcsFf"),
      baseVault: new PublicKey("2meN5DuUivsc8GkSou5vDRXYEx41BfpT9GLLADwetuMD"),
      quoteVault: new PublicKey("sWDtX6Xv6aQETZuYeBwJi3VWf8b81j6vUXSjV58hapK"),
      withdrawQueue: new PublicKey("11111111111111111111111111111111"),
      lpVault: new PublicKey("11111111111111111111111111111111"),
      marketVersion: 3,
      marketProgramId: new PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj"),
      marketId: new PublicKey("5gg4ovkjv8mRp9VVuexXhXmfN4JKqMZ9SuwCyasbLwVB"),
      marketAuthority: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
      marketBaseVault: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
      marketQuoteVault: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
      marketBids: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
      marketAsks: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
      marketEventQueue: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
    };
    
    // Create tokens
    const baseToken = new Token(TOKEN_PROGRAM_ID, poolKeys.baseMint, poolKeys.baseDecimals);
    const quoteToken = new Token(TOKEN_PROGRAM_ID, poolKeys.quoteMint, poolKeys.quoteDecimals);
    
    // Amount to swap
    const amountIn = new TokenAmount(baseToken, 0.005 * LAMPORTS_PER_SOL);
    const slippage = new Percent(5, 100); // 5%
    
    console.log("\\n🔄 Creating atomic round-trip transaction...");
    console.log("Amount:", amountIn.toFixed(), "SOL");
    
    // Step 1: SOL -> USDC
    const { innerTransactions: swapTx1 } = await Liquidity.makeSwapInstructionSimple({
      connection,
      poolKeys,
      userKeys: {
        tokenAccountIn: await getAssociatedTokenAddress(NATIVE_MINT, wallet.publicKey),
        tokenAccountOut: await getAssociatedTokenAddress(poolKeys.quoteMint, wallet.publicKey),
        owner: wallet.publicKey,
      },
      amountIn,
      amountOut: new TokenAmount(quoteToken, 1), // Minimum out
      fixedSide: 'in',
    });
    
    console.log("✅ Step 1: SOL -> USDC instruction created");
    
    // For atomic execution, we would need to:
    // 1. Get the output amount from step 1
    // 2. Create step 2 instruction: USDC -> SOL
    // 3. Combine both in single transaction
    
    console.log("\\n📝 Atomic Transaction Structure:");
    console.log("1. Swap SOL -> USDC");
    console.log("2. Swap USDC -> SOL (in same transaction)");
    console.log("3. Net result: Small profit/loss from price impact");
    
    console.log("\\n💡 Note: This demonstrates the structure.");
    console.log("For full implementation, combine both swaps in one transaction.");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

directAtomicSwap();
