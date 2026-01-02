import { Connection, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";

dotenv.config();

async function analyzeTransaction(signature: string) {
  const connection = new Connection("https://api.devnet.solana.com");
  
  try {
    console.log(`Analyzing transaction: ${signature}\n`);
    
    // Get transaction details
    const transaction = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0
    });
    
    if (!transaction) {
      console.log("Transaction not found on devnet");
      return;
    }
    
    console.log("TRANSACTION ANALYSIS");
    console.log("=".repeat(50));
    
    // Basic info
    console.log(`Slot: ${transaction.slot}`);
    console.log(`Block Time: ${new Date(transaction.blockTime * 1000).toISOString()}`);
    console.log(`Fee: ${transaction.meta.fee / 1000000000} SOL`);
    console.log(`Status: ${transaction.meta.err ? 'FAILED' : 'SUCCESS'}`);
    
    if (transaction.meta.err) {
      console.log(`Error: ${JSON.stringify(transaction.meta.err)}`);
    }
    
    // Compute units
    console.log(`Compute Units Consumed: ${transaction.meta.computeUnitsConsumed?.toLocaleString() || 'N/A'}`);
    
    // Account changes
    console.log(`\nACCOUNT CHANGES:`);
    console.log("-".repeat(30));
    
    const preBalances = transaction.meta.preBalances;
    const postBalances = transaction.meta.postBalances;
    const accounts = transaction.transaction.message.accountKeys;
    
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      const preBalance = preBalances[i] / 1000000000;
      const postBalance = postBalances[i] / 1000000000;
      const change = postBalance - preBalance;
      
      if (change !== 0) {
        console.log(`${account.toString()}: ${preBalance} → ${postBalance} SOL (${change > 0 ? '+' : ''}${change})`);
      }
    }
    
    // Token balance changes
    if (transaction.meta.preTokenBalances && transaction.meta.postTokenBalances) {
      console.log(`\nTOKEN BALANCE CHANGES:`);
      console.log("-".repeat(30));
      
      const preTokenBalances = transaction.meta.preTokenBalances;
      const postTokenBalances = transaction.meta.postTokenBalances;
      
      // Create maps for easier comparison
      const preTokenMap = new Map();
      const postTokenMap = new Map();
      
      preTokenBalances.forEach(balance => {
        preTokenMap.set(`${balance.accountIndex}-${balance.mint}`, balance);
      });
      
      postTokenBalances.forEach(balance => {
        postTokenMap.set(`${balance.accountIndex}-${balance.mint}`, balance);
      });
      
      // Check for changes
      const allKeys = new Set([...preTokenMap.keys(), ...postTokenMap.keys()]);
      
      for (const key of allKeys) {
        const pre = preTokenMap.get(key);
        const post = postTokenMap.get(key);
        
        const preAmount = pre ? parseFloat(pre.uiTokenAmount.uiAmountString) : 0;
        const postAmount = post ? parseFloat(post.uiTokenAmount.uiAmountString) : 0;
        const change = postAmount - preAmount;
        
        if (change !== 0) {
          const mint = (pre || post).mint;
          const accountIndex = (pre || post).accountIndex;
          const account = accounts[accountIndex];
          
          console.log(`${account.toString().slice(0, 8)}... (${mint.slice(0, 8)}...): ${preAmount} → ${postAmount} (${change > 0 ? '+' : ''}${change})`);
        }
      }
    }
    
    // Instructions
    console.log(`\nINSTRUCTIONS:`);
    console.log("-".repeat(30));
    
    const instructions = transaction.transaction.message.instructions;
    
    for (let i = 0; i < instructions.length; i++) {
      const instruction = instructions[i];
      const programId = accounts[instruction.programIdIndex];
      
      console.log(`${i + 1}. Program: ${programId.toString()}`);
      console.log(`   Data: ${Buffer.from(instruction.data).toString('hex')}`);
      console.log(`   Accounts: ${instruction.accounts.length}`);
    }
    
    // Logs
    if (transaction.meta.logMessages && transaction.meta.logMessages.length > 0) {
      console.log(`\nTRANSACTION LOGS:`);
      console.log("-".repeat(30));
      
      transaction.meta.logMessages.forEach((log, index) => {
        console.log(`${index + 1}. ${log}`);
      });
    }
    
    console.log(`\nEXPLORER LINKS:`);
    console.log("-".repeat(30));
    console.log(`Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log(`Solscan: https://solscan.io/tx/${signature}?cluster=devnet`);
    
  } catch (error) {
    console.error("Error analyzing transaction:", error);
  }
}

// Analyze the provided transaction
analyzeTransaction("46Zy6GWatC4pcoKgxM54tUp2oTnug9KMfsEGZMi3Y71yCaWa5nJRgLU5SjfHBXd1Q91rfEfXsQNSfLZcoXCXnq9x");
