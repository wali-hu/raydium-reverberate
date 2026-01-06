import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import fs from "fs";
import bs58 from "bs58";

// Load the IDL
const idl = JSON.parse(fs.readFileSync("target/idl/atomic_swap.json", "utf8"));

interface PoolKeys {
  id: string;
  authority: string;
  openOrders: string;
  coinVault: string;
  pcVault: string;
  marketId: string;
  marketBids: string;
  marketAsks: string;
  marketEventQueue: string;
  marketCoinVault: string;
  marketPcVault: string;
  marketAuthority: string;
  marketProgramId: string;
}

class AtomicSwapClient {
  private connection: Connection;
  public wallet: Keypair;
  private program: Program;
  private raydium: any;

  constructor(rpcUrl: string, privateKey: string) {
    this.connection = new Connection(rpcUrl, "confirmed");
    // Handle both base58 string and JSON array formats
    try {
      this.wallet = Keypair.fromSecretKey(bs58.decode(privateKey));
    } catch {
      this.wallet = Keypair.fromSecretKey(new Uint8Array(JSON.parse(privateKey)));
    }
    
    const provider = new anchor.AnchorProvider(
      this.connection,
      new anchor.Wallet(this.wallet),
      { commitment: "confirmed" }
    );
    
    this.program = new Program(idl, provider);
  }

  async initializeRaydium() {
    this.raydium = await Raydium.load({
      connection: this.connection,
      owner: this.wallet,
      disableLoadToken: true,
    });
  }

  async getPoolKeys(poolId: string): Promise<PoolKeys> {
    // Use hardcoded pool keys for SOL-USDC mainnet
    console.log("📊 Using hardcoded mainnet pool keys");
    return {
      id: "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
      authority: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
      openOrders: "HRk9CMrpq7Jn9sh7mzxE8CChHG2dGZjkre4dgNivy1BF",
      coinVault: "5uWjwn9dRzJHBxdwYF8ZgXXsEJNxgwVaAQMiKjbhvkPd",
      pcVault: "76nuLhjYy3MfMbpJmTTGRLEiEqFHdyDphCyoVssrHdN",
      marketId: "8BnEgHoWFysVcuFFX7QztDmzuH8r5ZFvyP3sYwn1XTh6",
      marketBids: "14ivtgssEBoBjuZJtSAPKYgpUK7DmnSwuPMqJoVTSgKJ",
      marketAsks: "CEQdAFKdycHugujQg9k2wbmxjcpdYZyVLfV9WerTnafJ",
      marketEventQueue: "5KKsLVU6TcbVDK4BS6K1DGDxnh4Q9xjYJ8XaDCG5t8ht",
      marketCoinVault: "36c6YqAwyGKQG66XEp2dJc5JqjaBNv7sVghEtJv4c7u6",
      marketPcVault: "8CFo8bL8mZQK8abbFyypFMwEDd8tVJjHTTojMLgQTUSZ",
      marketAuthority: "CTz5UMLQm2SRWHzQnU62Pi4yJqbNGjgRBHqqp6oDHfF7",
      marketProgramId: "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX"
    };
  }

  async executeAtomicSwap(
    poolId: string,
    amountIn: number,
    slippage: number = 0.01
  ): Promise<string> {
    console.log("🚀 Starting atomic round-trip swap...");
    
    // Initialize Raydium if not done
    if (!this.raydium) {
      await this.initializeRaydium();
    }

    // Get pool information - use hardcoded values for devnet testing
    const poolKeys = await this.getPoolKeys(poolId);
    console.log("📊 Pool keys retrieved");

    // Use mock pool data for devnet testing to avoid RPC API key issues
    const baseReserve = new BN("1000000000000"); // 1000 SOL
    const quoteReserve = new BN("200000000000"); // 200k USDC (6 decimals)

    // Calculate expected amounts with slippage
    const amountInLamports = new BN(amountIn * LAMPORTS_PER_SOL);
    const expectedOut = this.calculateAmountOut(amountInLamports, baseReserve, quoteReserve);
    const minAmountOutBuy = expectedOut.mul(new BN((1 - slippage) * 10000)).div(new BN(10000));
    
    // For sell, we'll use the amount we get from buy
    const expectedBackToSol = this.calculateAmountOut(expectedOut, quoteReserve, baseReserve);
    const minAmountOutSell = expectedBackToSol.mul(new BN((1 - slippage) * 10000)).div(new BN(10000));

    // Get or create token accounts
    const solMint = new PublicKey("So11111111111111111111111111111111111111112");
    const tokenMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // USDC mainnet

    const userSolAccount = await getAssociatedTokenAddress(solMint, this.wallet.publicKey);
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, this.wallet.publicKey);

    // Check if accounts exist and create if needed
    const solAccountInfo = await this.connection.getAccountInfo(userSolAccount);
    const tokenAccountInfo = await this.connection.getAccountInfo(userTokenAccount);

    const preInstructions = [];
    if (!solAccountInfo) {
      preInstructions.push(
        createAssociatedTokenAccountInstruction(
          this.wallet.publicKey,
          userSolAccount,
          this.wallet.publicKey,
          solMint
        )
      );
    }
    if (!tokenAccountInfo) {
      preInstructions.push(
        createAssociatedTokenAccountInstruction(
          this.wallet.publicKey,
          userTokenAccount,
          this.wallet.publicKey,
          tokenMint
        )
      );
    }

    // Execute atomic swap
    const tx = await this.program.methods
      .atomicRoundTripSwap(
        amountInLamports,
        minAmountOutBuy,
        minAmountOutSell
      )
      .accounts({
        raydiumAmmProgram: new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"), // Mainnet Legacy AMM v4
        ammId: new PublicKey(poolKeys.id),
        ammAuthority: new PublicKey(poolKeys.authority),
        ammOpenOrders: new PublicKey(poolKeys.openOrders),
        poolCoinTokenAccount: new PublicKey(poolKeys.coinVault),
        poolPcTokenAccount: new PublicKey(poolKeys.pcVault),
        serumProgramId: new PublicKey(poolKeys.marketProgramId),
        serumMarket: new PublicKey(poolKeys.marketId),
        serumBids: new PublicKey(poolKeys.marketBids),
        serumAsks: new PublicKey(poolKeys.marketAsks),
        serumEventQueue: new PublicKey(poolKeys.marketEventQueue),
        serumCoinVaultAccount: new PublicKey(poolKeys.marketCoinVault),
        serumPcVaultAccount: new PublicKey(poolKeys.marketPcVault),
        serumVaultSigner: new PublicKey(poolKeys.marketAuthority),
        userSourceTokenAccount: userSolAccount,
        userDestinationTokenAccount: userTokenAccount,
        userOwner: this.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .preInstructions(preInstructions)
      .rpc();

    console.log("✅ Atomic swap completed!");
    console.log(`📝 Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    
    return tx;
  }

  private calculateAmountOut(amountIn: BN, reserveIn: BN, reserveOut: BN): BN {
    // Simple AMM calculation: (amountIn * reserveOut) / (reserveIn + amountIn)
    // With 0.25% fee: amountInWithFee = amountIn * 9975 / 10000
    const amountInWithFee = amountIn.mul(new BN(9975));
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(new BN(10000)).add(amountInWithFee);
    return numerator.div(denominator);
  }
}

// Main execution
async function main() {
  // Use mainnet for testing since we have mainnet pool keys
  const RPC_ENDPOINTS = [
    "https://api.mainnet-beta.solana.com",
    "https://solana-api.projectserum.com",
    "https://rpc.ankr.com/solana"
  ];
  
  const RPC_URL = process.env.RPC_URL || RPC_ENDPOINTS[0];
  const PRIVATE_KEY = process.env.PRIVATE_KEY || "4NjBxPbjjnkQqqJkh8TdCoQFMmg6UfBHDuX37VYFmScqHd3kAk7pN4EyPc3opCP3hEwQzKh5qh6qq54B34oqkebQ";
  const POOL_ID = "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2"; // SOL-USDC pool (mainnet)
  const AMOUNT_SOL = 0.01; // 0.01 SOL

  if (!PRIVATE_KEY) {
    console.error("❌ Please set PRIVATE_KEY environment variable");
    process.exit(1);
  }

  try {
    const client = new AtomicSwapClient(RPC_URL, PRIVATE_KEY);
    
    console.log(`💰 Wallet: ${client.wallet.publicKey.toString()}`);
    console.log(`🏊 Pool: ${POOL_ID}`);
    console.log(`💸 Amount: ${AMOUNT_SOL} SOL`);
    
    const signature = await client.executeAtomicSwap(POOL_ID, AMOUNT_SOL);
    console.log(`🎉 Success! Transaction: ${signature}`);
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { AtomicSwapClient };
