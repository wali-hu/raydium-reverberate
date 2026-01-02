import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  SystemProgram
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint
} from "@solana/spl-token";
import * as dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

class SimpleTokenCreator {
  connection: Connection;
  payer: Keypair;

  constructor() {
    this.connection = new Connection("https://api.devnet.solana.com");
    this.payer = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY!));
  }

  async createToken(name: string, supply: number) {
    console.log(`Creating ${name} token...`);
    
    try {
      // Generate new mint keypair
      const mint = Keypair.generate();
      
      // Get minimum balance for mint
      const mintRent = await getMinimumBalanceForRentExemptMint(this.connection);
      
      // Get associated token account address
      const tokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        this.payer.publicKey
      );

      // Create transaction
      const transaction = new Transaction().add(
        // Create mint account
        SystemProgram.createAccount({
          fromPubkey: this.payer.publicKey,
          newAccountPubkey: mint.publicKey,
          space: MINT_SIZE,
          lamports: mintRent,
          programId: TOKEN_PROGRAM_ID,
        }),
        // Initialize mint
        createInitializeMintInstruction(
          mint.publicKey,
          9, // decimals
          this.payer.publicKey, // mint authority
          this.payer.publicKey  // freeze authority
        ),
        // Create associated token account
        createAssociatedTokenAccountInstruction(
          this.payer.publicKey,
          tokenAccount,
          this.payer.publicKey,
          mint.publicKey
        ),
        // Mint tokens
        createMintToInstruction(
          mint.publicKey,
          tokenAccount,
          this.payer.publicKey,
          supply * Math.pow(10, 9)
        )
      );

      // Send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.payer, mint]
      );

      console.log(`${name} created successfully!`);
      console.log(`   Mint: ${mint.publicKey.toString()}`);
      console.log(`   Token Account: ${tokenAccount.toString()}`);
      console.log(`   Supply: ${supply.toLocaleString()}`);
      console.log(`   Transaction: ${signature}`);
      console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

      return {
        name,
        mint: mint.publicKey.toString(),
        tokenAccount: tokenAccount.toString(),
        supply,
        signature
      };

    } catch (error) {
      console.error(`Failed to create ${name}:`, error);
      throw error;
    }
  }

  async createDevnetTokens() {
    console.log("Creating Custom Devnet Tokens\n");

    // Check balance
    const balance = await this.connection.getBalance(this.payer.publicKey);
    console.log(`Wallet: ${this.payer.publicKey.toString()}`);
    console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);

    if (balance < 0.05 * LAMPORTS_PER_SOL) {
      throw new Error("Need at least 0.05 SOL for token creation");
    }

    // Create tokens
    const tokenA = await this.createToken("DEVUSDC", 1000000);
    console.log("");
    
    const tokenB = await this.createToken("DEVTEST", 500000);
    console.log("");

    console.log("ALL TOKENS CREATED SUCCESSFULLY!\n");
    
    console.log("SUMMARY:");
    console.log(`${tokenA.name}: ${tokenA.mint}`);
    console.log(`${tokenB.name}: ${tokenB.mint}`);
    console.log(`SOL: So11111111111111111111111111111111111111112`);

    console.log("\nREADY FOR POOL CREATION!");
    console.log("Use these token mints to create your Raydium pool:");
    console.log(`- Base Token: ${tokenA.mint}`);
    console.log(`- Quote Token: So11111111111111111111111111111111111111112 (SOL)`);

    return {
      tokenA,
      tokenB,
      sol: "So11111111111111111111111111111111111111112"
    };
  }
}

// Execute token creation
async function main() {
  const creator = new SimpleTokenCreator();
  
  try {
    const tokens = await creator.createDevnetTokens();
    
    console.log("\nSAVE THESE FOR YOUR ATOMIC SWAP:");
    console.log(`export const CUSTOM_TOKEN_A = "${tokens.tokenA.mint}";`);
    console.log(`export const CUSTOM_TOKEN_B = "${tokens.tokenB.mint}";`);
    console.log(`export const SOL_MINT = "${tokens.sol}";`);
    
  } catch (error) {
    console.error("Token creation failed:", error);
  }
}

main();
