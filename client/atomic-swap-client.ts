// client/atomic-swap-client.ts (REPLACEMENT)
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import fetch from "node-fetch";
import { Connection, PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import fs from "fs";
import bs58 from "bs58";
import dotenv from 'dotenv';
dotenv.config({ path: './config/.env' });

console.log("PK loaded:", process.env.PRIVATE_KEY?.slice(0, 5));


// Load the IDL
const idl = JSON.parse(fs.readFileSync("target/idl/atomic_swap.json", "utf8"));

interface PoolKeys {
  id: string;
  authority: string;
  openOrders: string;
  targetOrders: string;
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
  private rpcUrl: string;

  constructor(rpcUrl: string, privateKey: string) {
    this.rpcUrl = rpcUrl;
    this.connection = new Connection(rpcUrl, "confirmed");
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

    // program id resolved from IDL (Anchor will pick from workspace deploy); keep as-is
    this.program = new Program(idl as any, provider);
  }

  async initializeRaydium() {
    this.raydium = await Raydium.load({
      connection: this.connection,
      owner: this.wallet,
      disableLoadToken: true,
    });
  }

  // Fetch pools from Raydium devnet API and match by mints
  async findDevnetPoolByMints(baseMint: string, quoteMint: string) {
    const url = "https://api-v3-devnet.raydium.io/amm/pools?limit=500";
    const res = await fetch(url);
    const body = await res.json();
    const pools = (body.data || body) as any[];
    const pool = pools.find(p =>
      (p.baseMint === baseMint && p.quoteMint === quoteMint) ||
      (p.baseMint === quoteMint && p.quoteMint === baseMint)
    );
    if (!pool) throw new Error("No devnet pool found for pair. You may need to create/fund a pool on devnet.");
    return pool;
  }

  // Map API pool object to PoolKeys (try common field names)
  async getPoolKeysFromApi(poolObj: any): Promise<PoolKeys> {
    return {
      id: poolObj.ammId || poolObj.id || poolObj.ammIdPublicKey || poolObj.amm_id,
      authority: poolObj.ammAuthority || poolObj.authority || poolObj.ammAuthorityPublicKey,
      openOrders: poolObj.openOrders || poolObj.ammOpenOrders,
      targetOrders: poolObj.targetOrders || poolObj.ammTargetOrders || poolObj.openOrders,
      coinVault: poolObj.baseVault || poolObj.poolCoinTokenAccount || poolObj.ammBaseVault,
      pcVault: poolObj.quoteVault || poolObj.poolPcTokenAccount || poolObj.ammQuoteVault,
      marketId: poolObj.marketId || poolObj.serumMarket || poolObj.market,
      marketBids: poolObj.marketBids,
      marketAsks: poolObj.marketAsks,
      marketEventQueue: poolObj.marketEventQueue,
      marketCoinVault: poolObj.marketCoinVault || poolObj.marketCoinVaultAccount,
      marketPcVault: poolObj.marketPcVault || poolObj.marketPcVaultAccount,
      marketAuthority: poolObj.marketAuthority || poolObj.serumVaultSigner,
      marketProgramId: poolObj.marketProgramId || poolObj.serumProgramId || poolObj.marketProgram,
    };
  }

  async executeAtomicSwap(
    baseMintStr: string,
    quoteMintStr: string,
    amountIn: number,
    slippage: number = 0.01
  ): Promise<string> {
    if (!this.raydium) await this.initializeRaydium();

    // find pool on devnet (throws if not found)
    const poolObj = await this.findDevnetPoolByMints(baseMintStr, quoteMintStr);
    const poolKeys = await this.getPoolKeysFromApi(poolObj);

    // Use devnet program id for Raydium legacy AMM (adjust if your pool type differs)
    const raydiumProgramPubkey = this.rpcUrl.includes("devnet")
      ? new PublicKey("DRaya7Kj3aMWQSy19kSjvmuwq9docCHofyP9kanQGaav")
      : new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

    const solMint = new PublicKey(baseMintStr);
    const tokenMint = new PublicKey(quoteMintStr);

    // mocked reserves for on-chain calc (keep as before)
    const baseReserve = new BN("1000000000000");
    const quoteReserve = new BN("200000000000");
    const amountInLamports = new BN(amountIn * LAMPORTS_PER_SOL);

    const expectedOut = this.calculateAmountOut(amountInLamports, baseReserve, quoteReserve);
    const minAmountOutBuy = expectedOut.mul(new BN((1 - slippage) * 10000)).div(new BN(10000));
    const expectedBackToSol = this.calculateAmountOut(expectedOut, quoteReserve, baseReserve);
    const minAmountOutSell = expectedBackToSol.mul(new BN((1 - slippage) * 10000)).div(new BN(10000));

    const userSolAccount = await getAssociatedTokenAddress(solMint, this.wallet.publicKey);
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, this.wallet.publicKey);

    const solAccountInfo = await this.connection.getAccountInfo(userSolAccount);
    const tokenAccountInfo = await this.connection.getAccountInfo(userTokenAccount);

    const preInstructions: any[] = [];
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

    const tx = await this.program.methods
      .atomicRoundTripSwap(
        amountInLamports,
        minAmountOutBuy,
        minAmountOutSell
      )
      .accounts({
        raydiumAmmProgram: raydiumProgramPubkey,
        ammId: new PublicKey(poolKeys.id),
        ammAuthority: new PublicKey(poolKeys.authority),
        ammOpenOrders: new PublicKey(poolKeys.openOrders),
        ammTargetOrders: new PublicKey(poolKeys.targetOrders),
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

    return tx;
  }

  private calculateAmountOut(amountIn: BN, reserveIn: BN, reserveOut: BN): BN {
    const amountInWithFee = amountIn.mul(new BN(9975));
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(new BN(10000)).add(amountInWithFee);
    return numerator.div(denominator);
  }
}

// Main
async function main() {
  const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
  const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
  if (!PRIVATE_KEY) { console.error("Set PRIVATE_KEY"); process.exit(1); }

  // Devnet wrapped SOL & devnet USDC
  const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";
  const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

  const POOL_BASE = WRAPPED_SOL_MINT;
  const POOL_QUOTE = DEVNET_USDC_MINT;
  const AMOUNT_SOL = 0.01;

  const client = new AtomicSwapClient(RPC_URL, PRIVATE_KEY);
  console.log(`Wallet: ${client.wallet.publicKey.toString()}`);
  console.log(`Pair: ${POOL_BASE} / ${POOL_QUOTE}`);
  try {
    const sig = await client.executeAtomicSwap(POOL_BASE, POOL_QUOTE, AMOUNT_SOL);
    console.log("Tx:", sig);
  } catch (e: any) {
    console.error("Error:", e.message || e);
    process.exit(1);
  }
}

if (require.main === module) main();

export { AtomicSwapClient };
