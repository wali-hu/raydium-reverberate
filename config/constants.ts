/**
 * Configuration Constants
 * Author: Abdullah
 */

import { PublicKey } from "@solana/web3.js";

export const CONFIG = {
  RPC_URL: "https://api.devnet.solana.com",
  COMMITMENT: "confirmed" as const,
  
  ATOMIC_SWAP_PROGRAM_ID: new PublicKey("c6yDi5Z8AjensVGtu7WrsoL4T2XLVChLQo9t7MbYahg"),
  DEVUSDC: new PublicKey("7yPDSToUbixNUmvRuEFFW4Q9omaqSUR192Xo4zuqGDSR"),
  
  DEFAULT_SWAP_AMOUNT: 0.01,
  DEFAULT_SWAP_COUNT: 3,
  SWAP_DELAY_MS: 2000,
  POOL_SPACE: 1000,
} as const;
