#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    account_info::AccountInfo, instruction::Instruction, program::invoke,
};
use anchor_spl::token::{spl_token, Token, TokenAccount};

// Simple instruction builder for Raydium AMM swaps
pub fn create_swap_instruction(
    program_id: &Pubkey,
    amm_id: &Pubkey,
    amm_authority: &Pubkey,
    amm_open_orders: &Pubkey,
    amm_target_orders: &Pubkey,
    pool_coin_token_account: &Pubkey,
    pool_pc_token_account: &Pubkey,
    serum_program_id: &Pubkey,
    serum_market: &Pubkey,
    serum_bids: &Pubkey,
    serum_asks: &Pubkey,
    serum_event_queue: &Pubkey,
    serum_coin_vault_account: &Pubkey,
    serum_pc_vault_account: &Pubkey,
    serum_vault_signer: &Pubkey,
    user_source_token_account: &Pubkey,
    user_destination_token_account: &Pubkey,
    user_owner: &Pubkey,
    amount_in: u64,
    minimum_amount_out: u64,
) -> Result<Instruction> {
    msg!("=== BUILDING SWAP INSTRUCTION ===");
    msg!("Program ID: {}", program_id);
    msg!("Amount in: {}", amount_in);
    msg!("Minimum amount out: {}", minimum_amount_out);
    msg!("Source account: {}", user_source_token_account);
    msg!("Destination account: {}", user_destination_token_account);

    // This is a simplified instruction builder
    // In production, you'd use the actual Raydium SDK
    let accounts = vec![
        AccountMeta::new_readonly(spl_token::id(), false),
        AccountMeta::new(*amm_id, false),
        AccountMeta::new_readonly(*amm_authority, false),
        AccountMeta::new(*amm_open_orders, false),
        AccountMeta::new(*amm_target_orders, false),
        AccountMeta::new(*pool_coin_token_account, false),
        AccountMeta::new(*pool_pc_token_account, false),
        AccountMeta::new_readonly(*serum_program_id, false),
        AccountMeta::new(*serum_market, false),
        AccountMeta::new(*serum_bids, false),
        AccountMeta::new(*serum_asks, false),
        AccountMeta::new(*serum_event_queue, false),
        AccountMeta::new(*serum_coin_vault_account, false),
        AccountMeta::new(*serum_pc_vault_account, false),
        AccountMeta::new_readonly(*serum_vault_signer, false),
        AccountMeta::new(*user_source_token_account, false),
        AccountMeta::new(*user_destination_token_account, false),
        AccountMeta::new_readonly(*user_owner, true),
    ];

    msg!("Created {} account metas", accounts.len());

    let mut data = Vec::new();
    data.extend_from_slice(&9u8.to_le_bytes()); // swap instruction discriminator
    data.extend_from_slice(&amount_in.to_le_bytes());
    data.extend_from_slice(&minimum_amount_out.to_le_bytes());

    msg!("Instruction data length: {} bytes", data.len());
    msg!("=== SWAP INSTRUCTION BUILT SUCCESSFULLY ===");

    Ok(Instruction {
        program_id: *program_id,
        accounts,
        data,
    })
}

declare_id!("HbiVxY1bVwZmsC18H8yzFk6tc2Vj2pKKS5BXHThXwVcG");

#[program]
pub mod atomic_swap {
    use super::*;

    /// Atomic round-trip swap:
    /// 1) Swap amount_in (from `user_source_token_account`) -> `user_destination_token_account`
    ///    (a buy)
    /// 2) Read the exact tokens received
    /// 3) Swap those tokens back (sell) using the pool — all in the same instruction
    pub fn atomic_round_trip_swap(
        ctx: Context<AtomicRoundTripSwap>,
        amount_in: u64,
        minimum_amount_out_buy: u64,
        minimum_amount_out_sell: u64,
    ) -> Result<()> {
        msg!("=== ATOMIC ROUND TRIP SWAP STARTED ===");
        msg!("Input parameters:");
        msg!("  amount_in: {}", amount_in);
        msg!("  minimum_amount_out_buy: {}", minimum_amount_out_buy);
        msg!("  minimum_amount_out_sell: {}", minimum_amount_out_sell);

        // Log all account information for debugging
        ctx.accounts.log_account_info();

        // Validate input parameters
        msg!("=== PARAMETER VALIDATION ===");
        require!(amount_in > 0, ErrorCode::InvalidAmount);
        require!(minimum_amount_out_buy > 0, ErrorCode::InvalidMinimumOut);
        require!(minimum_amount_out_sell > 0, ErrorCode::InvalidMinimumOut);
        msg!("All parameters validated successfully");

        // Check source account balance
        msg!("=== BALANCE CHECKS ===");
        let source_balance = ctx.accounts.user_source_token_account.amount;
        msg!("Source account balance: {}", source_balance);
        require!(source_balance >= amount_in, ErrorCode::InsufficientBalance);
        msg!("Sufficient balance confirmed");

        // 1) Record pre-buy destination balance
        let before = ctx.accounts.user_destination_token_account.amount;
        msg!("Pre-buy destination balance: {}", before);

        // 2) Build the Raydium buy instruction using the helper (SwapBaseIn)
        // NOTE: swap_base_in returns a solana_program::instruction::Instruction
        msg!("Building buy instruction...");
        msg!("  AMM ID: {}", ctx.accounts.amm_id.key());
        msg!(
            "  User source: {}",
            ctx.accounts.user_source_token_account.key()
        );
        msg!(
            "  User destination: {}",
            ctx.accounts.user_destination_token_account.key()
        );

        let buy_ix = create_swap_instruction(
            ctx.accounts.raydium_amm_program.key,
            ctx.accounts.amm_id.key,
            ctx.accounts.amm_authority.key,
            ctx.accounts.amm_open_orders.key,
            ctx.accounts.amm_target_orders.key,
            ctx.accounts.pool_coin_token_account.key,
            ctx.accounts.pool_pc_token_account.key,
            ctx.accounts.serum_program_id.key,
            ctx.accounts.serum_market.key,
            ctx.accounts.serum_bids.key,
            ctx.accounts.serum_asks.key,
            ctx.accounts.serum_event_queue.key,
            ctx.accounts.serum_coin_vault_account.key,
            ctx.accounts.serum_pc_vault_account.key,
            ctx.accounts.serum_vault_signer.key,
            &ctx.accounts.user_source_token_account.key(),
            &ctx.accounts.user_destination_token_account.key(),
            ctx.accounts.user_owner.key,
            amount_in,
            minimum_amount_out_buy,
        )
        .map_err(|e| {
            msg!("ERROR: Failed to build buy instruction: {:?}", e);
            error!(ErrorCode::RaydiumInstructionBuildFailed)
        })?;

        msg!("Buy instruction built successfully");

        // 3) Prepare account infos slice in the *exact* order Raydium expects.
        //    We'll use the same list used to construct the instruction.
        msg!("=== PREPARING BUY ACCOUNTS ===");
        msg!("Preparing {} accounts for buy CPI", 18);

        let buy_accounts = vec![
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.amm_id.to_account_info(),
            ctx.accounts.amm_authority.to_account_info(),
            ctx.accounts.amm_open_orders.to_account_info(),
            ctx.accounts.amm_target_orders.to_account_info(),
            ctx.accounts.pool_coin_token_account.to_account_info(),
            ctx.accounts.pool_pc_token_account.to_account_info(),
            ctx.accounts.serum_program_id.to_account_info(),
            ctx.accounts.serum_market.to_account_info(),
            ctx.accounts.serum_bids.to_account_info(),
            ctx.accounts.serum_asks.to_account_info(),
            ctx.accounts.serum_event_queue.to_account_info(),
            ctx.accounts.serum_coin_vault_account.to_account_info(),
            ctx.accounts.serum_pc_vault_account.to_account_info(),
            ctx.accounts.serum_vault_signer.to_account_info(),
            ctx.accounts.user_source_token_account.to_account_info(),
            ctx.accounts
                .user_destination_token_account
                .to_account_info(),
            ctx.accounts.user_owner.to_account_info(),
        ];
        msg!("Buy accounts prepared successfully");

        // 4) CPI invoke to Raydium (buy)
        msg!("Executing buy CPI call...");
        invoke(&buy_ix, &buy_accounts).map_err(|e| {
            msg!("ERROR: Buy CPI failed: {:?}", e);
            error!(ErrorCode::RaydiumCpiFailed)
        })?;
        msg!("Buy CPI completed successfully");

        // 5) Reload the destination token account and compute exact received amount
        msg!("=== POST-BUY BALANCE CALCULATION ===");
        msg!("Reloading destination account...");
        ctx.accounts
            .user_destination_token_account
            .reload()
            .map_err(|e| {
                msg!("ERROR: Failed to reload destination account: {:?}", e);
                e
            })?;

        let after = ctx.accounts.user_destination_token_account.amount;
        msg!("Post-buy destination balance: {}", after);

        let received = after.checked_sub(before).ok_or_else(|| {
            msg!(
                "ERROR: Balance computation failed - before: {}, after: {}",
                before,
                after
            );
            error!(ErrorCode::BalanceComputationFailed)
        })?;

        msg!("Tokens received from buy: {}", received);
        msg!(
            "Buy operation profit/loss: {} tokens",
            received as i64 - amount_in as i64
        );

        // sanity check: if we didn't receive tokens, fail early
        if received == 0 {
            msg!("ERROR: Zero tokens received from buy operation");
            return Err(error!(ErrorCode::ZeroReceived));
        }

        if received < minimum_amount_out_buy {
            msg!(
                "ERROR: Received {} tokens, but minimum required was {}",
                received,
                minimum_amount_out_buy
            );
            return Err(error!(ErrorCode::SlippageExceeded));
        }

        msg!("Buy operation successful, proceeding to sell");

        // 6) Build the sell instruction (swap back).
        //    NOTE: depending on pool orientation you might prefer SwapBaseOut (sell expecting amount_out)
        //    or SwapBaseIn with the token as input. Here we call SwapBaseOut to illustrate selling back.
        msg!("Building sell instruction...");
        msg!("  Selling {} tokens back", received);

        let sell_ix = create_swap_instruction(
            ctx.accounts.raydium_amm_program.key,
            ctx.accounts.amm_id.key,
            ctx.accounts.amm_authority.key,
            ctx.accounts.amm_open_orders.key,
            ctx.accounts.amm_target_orders.key,
            ctx.accounts.pool_coin_token_account.key,
            ctx.accounts.pool_pc_token_account.key,
            ctx.accounts.serum_program_id.key,
            ctx.accounts.serum_market.key,
            ctx.accounts.serum_bids.key,
            ctx.accounts.serum_asks.key,
            ctx.accounts.serum_event_queue.key,
            ctx.accounts.serum_coin_vault_account.key,
            ctx.accounts.serum_pc_vault_account.key,
            ctx.accounts.serum_vault_signer.key,
            &ctx.accounts.user_destination_token_account.key(), // now source
            &ctx.accounts.user_source_token_account.key(),      // now destination
            ctx.accounts.user_owner.key,
            received, // use exact received amount
            minimum_amount_out_sell,
        )
        .map_err(|e| {
            msg!("ERROR: Failed to build sell instruction: {:?}", e);
            error!(ErrorCode::RaydiumInstructionBuildFailed)
        })?;

        msg!("Sell instruction built successfully");

        // 7) Build account infos for the sell in the required order
        msg!("=== PREPARING SELL ACCOUNTS ===");
        msg!("Preparing {} accounts for sell CPI", 17);

        let sell_accounts = vec![
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.amm_id.to_account_info(),
            ctx.accounts.amm_authority.to_account_info(),
            ctx.accounts.amm_open_orders.to_account_info(),
            ctx.accounts.pool_coin_token_account.to_account_info(),
            ctx.accounts.pool_pc_token_account.to_account_info(),
            ctx.accounts.serum_program_id.to_account_info(),
            ctx.accounts.serum_market.to_account_info(),
            ctx.accounts.serum_bids.to_account_info(),
            ctx.accounts.serum_asks.to_account_info(),
            ctx.accounts.serum_event_queue.to_account_info(),
            ctx.accounts.serum_coin_vault_account.to_account_info(),
            ctx.accounts.serum_pc_vault_account.to_account_info(),
            ctx.accounts.serum_vault_signer.to_account_info(),
            ctx.accounts
                .user_destination_token_account
                .to_account_info(), // source
            ctx.accounts.user_source_token_account.to_account_info(), // dest
            ctx.accounts.user_owner.to_account_info(),
        ];
        msg!("Sell accounts prepared successfully");

        // 8) CPI invoke to Raydium (sell)
        msg!("Executing sell CPI call...");
        invoke(&sell_ix, &sell_accounts).map_err(|e| {
            msg!("ERROR: Sell CPI failed: {:?}", e);
            error!(ErrorCode::RaydiumCpiFailed)
        })?;
        msg!("Sell CPI completed successfully");

        // Final balance check
        msg!("=== FINAL BALANCE VERIFICATION ===");
        ctx.accounts
            .user_source_token_account
            .reload()
            .map_err(|e| {
                msg!("ERROR: Failed to reload source account: {:?}", e);
                e
            })?;

        let final_balance = ctx.accounts.user_source_token_account.amount;
        msg!("Final source balance: {}", final_balance);
        msg!(
            "Net change: {} tokens",
            final_balance as i64 - source_balance as i64
        );

        if final_balance < source_balance {
            let loss = source_balance.checked_sub(final_balance).unwrap();
            msg!("Round-trip resulted in {} token loss", loss);
        } else if final_balance > source_balance {
            let gain = final_balance.checked_sub(source_balance).unwrap();
            msg!("Round-trip resulted in {} token gain", gain);
        } else {
            msg!("Round-trip broke even");
        }

        // Atomic: if any CPI fails above, the entire instruction will fail and revert.
        msg!("=== ATOMIC ROUND TRIP SWAP COMPLETED SUCCESSFULLY ===");

        Ok(())
    }
}

#[derive(Accounts)]
pub struct AtomicRoundTripSwap<'info> {
    /// Raydium AMM program id (checked off-chain by client; never assumed)
    /// CHECK: we call it via CPI builder
    pub raydium_amm_program: AccountInfo<'info>,

    /// AMM pool account
    /// CHECK: passed by client; should be the pool state
    #[account(mut)]
    pub amm_id: AccountInfo<'info>,

    /// AMM authority (PDA)
    /// CHECK: Raydium AMM authority PDA
    pub amm_authority: AccountInfo<'info>,

    /// AMM open orders
    /// CHECK: Raydium AMM open orders account
    #[account(mut)]
    pub amm_open_orders: AccountInfo<'info>,

    /// AMM target orders (optional in some Raydium versions)
    /// CHECK: Raydium AMM target orders account
    #[account(mut)]
    pub amm_target_orders: AccountInfo<'info>,

    /// Pool coin token account
    /// CHECK: Raydium pool coin token account
    #[account(mut)]
    pub pool_coin_token_account: AccountInfo<'info>,

    /// Pool pc token account
    /// CHECK: Raydium pool PC token account
    #[account(mut)]
    pub pool_pc_token_account: AccountInfo<'info>,

    /// Serum program id
    /// CHECK: Serum DEX program ID
    pub serum_program_id: AccountInfo<'info>,

    /// Serum market
    /// CHECK: Serum market account
    #[account(mut)]
    pub serum_market: AccountInfo<'info>,

    /// Serum bids
    /// CHECK: Serum bids account
    #[account(mut)]
    pub serum_bids: AccountInfo<'info>,

    /// Serum asks
    /// CHECK: Serum asks account
    #[account(mut)]
    pub serum_asks: AccountInfo<'info>,

    /// Serum event queue
    /// CHECK: Serum event queue account
    #[account(mut)]
    pub serum_event_queue: AccountInfo<'info>,

    /// Serum coin vault
    /// CHECK: Serum coin vault account
    #[account(mut)]
    pub serum_coin_vault_account: AccountInfo<'info>,

    /// Serum pc vault
    /// CHECK: Serum PC vault account
    #[account(mut)]
    pub serum_pc_vault_account: AccountInfo<'info>,

    /// Serum vault signer
    /// CHECK: Serum vault signer PDA
    pub serum_vault_signer: AccountInfo<'info>,

    /// User's source token account (for initial amount_in). Must be writable.
    #[account(mut)]
    pub user_source_token_account: Account<'info, TokenAccount>,

    /// User's destination token account (where buy output goes). Must be writable.
    #[account(mut)]
    pub user_destination_token_account: Account<'info, TokenAccount>,

    /// The user's wallet who signs the transaction
    #[account(mut)]
    pub user_owner: Signer<'info>,

    /// SPL Token program
    pub token_program: Program<'info, Token>,
}

impl<'info> AtomicRoundTripSwap<'info> {
    pub fn log_account_info(&self) {
        msg!("=== ACCOUNT VALIDATION ===");
        msg!("Raydium AMM Program: {}", self.raydium_amm_program.key());
        msg!("AMM ID: {}", self.amm_id.key());
        msg!("AMM Authority: {}", self.amm_authority.key());
        msg!("AMM Open Orders: {}", self.amm_open_orders.key());
        msg!("AMM Target Orders: {}", self.amm_target_orders.key());
        msg!("Pool Coin Token: {}", self.pool_coin_token_account.key());
        msg!("Pool PC Token: {}", self.pool_pc_token_account.key());
        msg!("Serum Program: {}", self.serum_program_id.key());
        msg!("Serum Market: {}", self.serum_market.key());
        msg!("Serum Bids: {}", self.serum_bids.key());
        msg!("Serum Asks: {}", self.serum_asks.key());
        msg!("Serum Event Queue: {}", self.serum_event_queue.key());
        msg!("Serum Coin Vault: {}", self.serum_coin_vault_account.key());
        msg!("Serum PC Vault: {}", self.serum_pc_vault_account.key());
        msg!("Serum Vault Signer: {}", self.serum_vault_signer.key());
        msg!(
            "User Source Token: {}",
            self.user_source_token_account.key()
        );
        msg!(
            "User Destination Token: {}",
            self.user_destination_token_account.key()
        );
        msg!("User Owner: {}", self.user_owner.key());
        msg!("Token Program: {}", self.token_program.key());

        // Additional account state info
        msg!("=== ACCOUNT STATES ===");
        msg!("Source token mint: {}", self.user_source_token_account.mint);
        msg!(
            "Destination token mint: {}",
            self.user_destination_token_account.mint
        );
        msg!(
            "Source token owner: {}",
            self.user_source_token_account.owner
        );
        msg!(
            "Destination token owner: {}",
            self.user_destination_token_account.owner
        );
        msg!("=== END ACCOUNT VALIDATION ===");
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Failed to build Raydium instruction")]
    RaydiumInstructionBuildFailed,
    #[msg("Raydium CPI failed")]
    RaydiumCpiFailed,
    #[msg("Balance math failed")]
    BalanceComputationFailed,
    #[msg("Zero tokens received from buy")]
    ZeroReceived,
    #[msg("Invalid amount - must be greater than 0")]
    InvalidAmount,
    #[msg("Invalid minimum amount out - must be greater than 0")]
    InvalidMinimumOut,
    #[msg("Insufficient balance for swap")]
    InsufficientBalance,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
}
