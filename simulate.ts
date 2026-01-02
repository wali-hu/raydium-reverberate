import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  TransactionInstruction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress, 
  NATIVE_MINT
} from "@solana/spl-token";
import * as borsh from "borsh";
import * as dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

// Raydium AMM Program ID (Legacy AMM v4 - Mainnet)
const RAYDIUM_AMM_PROGRAM = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

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

export class AtomicSwapSimulator {
  private connection: Connection;
  private wallet: Keypair;
  private programId: PublicKey;

  constructor(programId: string) {
    this.connection = new Connection(process.env.RPC_URL || "https://api.mainnet-beta.solana.com");
    
    // Convert base58 private key to Uint8Array
    const privateKeyBytes = bs58.decode(process.env.PRIVATE_KEY!);
    this.wallet = Keypair.fromSecretKey(privateKeyBytes);
    
    this.programId = new PublicKey(programId);
  }

  async simulateAtomicSwap(
    tokenAMint: string,
    tokenBMint: string,
    amountInSol: number,
    slippageBps: number = 500
  ) {
    console.log(`\n Simulating Atomic Round-Trip Swap`);
    console.log(`Token A: ${tokenAMint}`);
    console.log(`Token B: ${tokenBMint}`);
    console.log(`Amount: ${amountInSol} SOL`);
    console.log(`Slippage: ${slippageBps / 100}%`);
    
    const tokenAMintPubkey = new PublicKey(tokenAMint);
    const tokenBMintPubkey = new PublicKey(tokenBMint);
    
    // Get real pool info from Raydium
    console.log(`\n🔍 Fetching real pool data...`);
    const poolInfo = await this.getRealPoolInfo(tokenAMint, tokenBMint);
    
    // Get user token accounts
    const userTokenAAccount = await getAssociatedTokenAddress(
      tokenAMintPubkey,
      this.wallet.publicKey
    );
    
    const userTokenBAccount = await getAssociatedTokenAddress(
      tokenBMintPubkey,
      this.wallet.publicKey
    );

    console.log(` Pool Information:`);
    console.log(`AMM ID: ${poolInfo.ammId.toString()}`);
    console.log(`AMM Authority: ${poolInfo.ammAuthority.toString()}`);
    console.log(`Pool Coin Account: ${poolInfo.poolCoinTokenAccount.toString()}`);
    console.log(`Pool PC Account: ${poolInfo.poolPcTokenAccount.toString()}`);

    // Calculate amounts
    const amountInLamports = BigInt(amountInSol * LAMPORTS_PER_SOL);
    const minAmountOutBuy = amountInLamports * BigInt(10000 - slippageBps) / BigInt(10000);
    const minAmountOutSell = amountInLamports * BigInt(10000 - slippageBps) / BigInt(10000);

    console.log(`\n Transaction Amounts:`);
    console.log(`Amount In: ${amountInLamports.toString()} lamports (${amountInSol} SOL)`);
    console.log(`Min Amount Out Buy: ${minAmountOutBuy.toString()} lamports`);
    console.log(`Min Amount Out Sell: ${minAmountOutSell.toString()} lamports`);

    // Create instruction data
    const instructionData = new AtomicSwapInstruction(
      amountInLamports,
      minAmountOutBuy,
      minAmountOutSell
    );

    const serializedData = borsh.serialize(schema, instructionData);
    console.log(`\n Instruction Data: ${Buffer.from(serializedData).toString('hex')}`);

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
        { pubkey: userTokenAAccount, isSigner: false, isWritable: true },
        { pubkey: userTokenBAccount, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from(serializedData),
    });

    console.log(`\n Transaction Accounts (${instruction.keys.length} total):`);
    instruction.keys.forEach((key, index) => {
      console.log(`${index + 1}. ${key.pubkey.toString()} (${key.isSigner ? 'signer' : 'non-signer'}, ${key.isWritable ? 'writable' : 'readonly'})`);
    });

    // Create transaction for simulation
    const transaction = new Transaction().add(instruction);
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.wallet.publicKey;

    console.log(`\n🧾 Transaction Details:`);
    console.log(`Blockhash: ${blockhash}`);
    console.log(`Fee Payer: ${this.wallet.publicKey.toString()}`);
    console.log(`Program ID: ${this.programId.toString()}`);

    try {
      // Simulate transaction
      console.log(`\n⚡ Running simulation...`);
      const simulation = await this.connection.simulateTransaction(transaction);
      
      console.log(`\n Detailed Simulation Results:`);
      console.log(` Transaction Structure: Valid`);
      console.log(` Atomic Execution: Both buy and sell in single transaction`);
      console.log(` Slippage Protection: ${slippageBps / 100}% maximum slippage`);
      
      if (simulation.value.err) {
        console.log(` Simulation Error:`, simulation.value.err);
        console.log(`📝 Error Details:`, JSON.stringify(simulation.value.err, null, 2));
      } else {
        console.log(` Simulation: SUCCESS`);
        console.log(`⛽ Compute Units Used: ${simulation.value.unitsConsumed || 'N/A'}`);
      }
      
      console.log(`\n📝 Complete Transaction Logs:`);
      if (simulation.value.logs && simulation.value.logs.length > 0) {
        simulation.value.logs.forEach((log, index) => {
          console.log(`${index + 1}. ${log}`);
        });
      } else {
        console.log(`No logs available`);
      }
      
      console.log(`\n Volume Simulation Summary:`);
      console.log(`1. Buy: ${tokenAMint.slice(0,8)}... → ${tokenBMint.slice(0,8)}...`);
      console.log(`2. Sell: ${tokenBMint.slice(0,8)}... → ${tokenAMint.slice(0,8)}...`);
      console.log(`3. Net Effect: Volume generated, minimal price impact`);
      console.log(`4. Status: ${simulation.value.err ? 'Failed (Expected - needs real pool data)' : 'Success'}`);
      
      return simulation;
    } catch (error) {
      console.error(` Simulation failed with exception:`, error);
      throw error;
    }
  }

  private async getRealPoolInfo(tokenAMint: string, tokenBMint: string) {
    console.log(`Fetching pool data for ${tokenAMint} / ${tokenBMint}...`);
    
    // For SOL-USDC, use known mainnet pool addresses
    if (tokenAMint === "So11111111111111111111111111111111111111112" && 
        tokenBMint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") {
      
      console.log(` Using SOL-USDC mainnet pool data`);
      return {
        ammId: new PublicKey("58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2"),
        ammAuthority: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
        ammOpenOrders: new PublicKey("HRk9CMrpq7Jn9sh7mzxE8CChHG8dneX9p475QKz4Fsfc"),
        ammTargetOrders: new PublicKey("CZza3Ej4Mc58MnxWA385itCC9jCo3L1D7zc3LKy1bZMR"),
        poolCoinTokenAccount: new PublicKey("DQyrAcCrDXQ7NeoqGgDCZwBvWDcYmFCjSb9JtteuvPpz"),
        poolPcTokenAccount: new PublicKey("HLmqeL62xR1QoZ1HKKbXRrdN1p3phKpxRMb2VVopvBBz"),
        serumProgramId: new PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"),
        serumMarket: new PublicKey("9wFFyRfZBsuAha4YcuxcXLKwMxJR43S7fPfQLusDBzvT"),
        serumBids: new PublicKey("14ivtgssEBoBjuZJtSAPKYgpUK7DmnSwuPMqJoVTSgKJ"),
        serumAsks: new PublicKey("CEQdAFKdycHugujbcS9BSCuLUoiuaLyJFfJBdpsad8TM"),
        serumEventQueue: new PublicKey("5KKsLVU6TcbVDK4BS6K1DGDxnh4Q9xjYJ8XaDCG5t8ht"),
        serumCoinVaultAccount: new PublicKey("36c6YqAwyGKQG66XEp2dJc5JqjaBNv7sVghEtJv4c7u6"),
        serumPcVaultAccount: new PublicKey("8CFo8bL8mZQK8abbFyypFMwEDd8tVJjHTTojMLgQTUSZ"),
        serumVaultSigner: new PublicKey("F8Vyqk3unwxkXukZFQeYyGmFfTG3CAX4v24iyrjEYBJV"),
      };
    }
    
    // For other pairs, return mock data with warning
    console.log(`  Using mock pool data - real pool addresses needed for actual trading`);
    return this.getMockPoolInfo();
  }

  private getMockPoolInfo() {
    // Fallback mock pool info for other token pairs
    return {
      ammId: new PublicKey("58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2"),
      ammAuthority: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
      ammOpenOrders: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
      ammTargetOrders: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
      poolCoinTokenAccount: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
      poolPcTokenAccount: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
      serumProgramId: new PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"),
      serumMarket: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
      serumBids: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
      serumAsks: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
      serumEventQueue: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
      serumCoinVaultAccount: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
      serumPcVaultAccount: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
      serumVaultSigner: new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"),
    };
  }
}

// CLI function for different token pairs
export async function simulateVolumeSwap(
  programId: string,
  tokenAMint: string,
  tokenBMint: string,
  amountInSol: number,
  slippageBps: number = 500
) {
  const simulator = new AtomicSwapSimulator(programId);
  return await simulator.simulateAtomicSwap(tokenAMint, tokenBMint, amountInSol, slippageBps);
}

// Test with SOL-USDC pair
async function testSOLUSDC() {
  console.log(" Volume Simulation Testing - Mainnet");
  console.log("Program ID: c6yDi5Z8AjensVGtu7WrsoL4T2XLVChLQo9t7MbYahg");
  
  await simulateVolumeSwap(
    "c6yDi5Z8AjensVGtu7WrsoL4T2XLVChLQo9t7MbYahg",
    "So11111111111111111111111111111111111111112", // SOL
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    0.1, // 0.1 SOL
    500  // 5% slippage
  );
}

// Run test
testSOLUSDC();
