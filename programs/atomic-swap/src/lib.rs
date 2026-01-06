use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

declare_id!("HbiVxY1bVwZmsC18H8yzFk6tc2Vj2pKKS5BXHThXwVcG");

#[program]
pub mod atomic_swap {
    use super::*;

    pub fn atomic_round_trip_swap(
        ctx: Context<AtomicRoundTripSwap>,
        amount_in: u64,
        minimum_amount_out_buy: u64,
        minimum_amount_out_sell: u64,
    ) -> Result<()> {
        // First swap: SOL -> Token
        let buy_accounts = vec![
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
            ctx.accounts.user_source_token_account.to_account_info(),
            ctx.accounts.user_destination_token_account.to_account_info(),
            ctx.accounts.user_owner.to_account_info(),
        ];

        // Buy instruction data
        let mut buy_data = vec![9]; // SwapBaseIn discriminator
        buy_data.extend_from_slice(&amount_in.to_le_bytes());
        buy_data.extend_from_slice(&minimum_amount_out_buy.to_le_bytes());

        let buy_ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: ctx.accounts.raydium_amm_program.key(),
            accounts: buy_accounts.iter().map(|acc| {
                if acc.is_writable {
                    AccountMeta::new(acc.key(), acc.is_signer)
                } else {
                    AccountMeta::new_readonly(acc.key(), acc.is_signer)
                }
            }).collect(),
            data: buy_data,
        };

        anchor_lang::solana_program::program::invoke(&buy_ix, &buy_accounts)?;

        // Get the amount we received from the buy
        ctx.accounts.user_destination_token_account.reload()?;
        let token_balance = ctx.accounts.user_destination_token_account.amount;

        // Second swap: Token -> SOL (sell back)
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
            ctx.accounts.user_destination_token_account.to_account_info(), // Now source
            ctx.accounts.user_source_token_account.to_account_info(), // Now destination
            ctx.accounts.user_owner.to_account_info(),
        ];

        // Sell instruction data
        let mut sell_data = vec![9]; // SwapBaseIn discriminator
        sell_data.extend_from_slice(&token_balance.to_le_bytes());
        sell_data.extend_from_slice(&minimum_amount_out_sell.to_le_bytes());

        let sell_ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: ctx.accounts.raydium_amm_program.key(),
            accounts: sell_accounts.iter().map(|acc| {
                if acc.is_writable {
                    AccountMeta::new(acc.key(), acc.is_signer)
                } else {
                    AccountMeta::new_readonly(acc.key(), acc.is_signer)
                }
            }).collect(),
            data: sell_data,
        };

        anchor_lang::solana_program::program::invoke(&sell_ix, &sell_accounts)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct AtomicRoundTripSwap<'info> {
    /// CHECK: Raydium AMM program
    pub raydium_amm_program: AccountInfo<'info>,
    
    /// CHECK: AMM pool account
    #[account(mut)]
    pub amm_id: AccountInfo<'info>,
    
    /// CHECK: AMM authority
    pub amm_authority: AccountInfo<'info>,
    
    /// CHECK: AMM open orders
    #[account(mut)]
    pub amm_open_orders: AccountInfo<'info>,
    
    /// CHECK: Pool coin token account
    #[account(mut)]
    pub pool_coin_token_account: AccountInfo<'info>,
    
    /// CHECK: Pool PC token account
    #[account(mut)]
    pub pool_pc_token_account: AccountInfo<'info>,
    
    /// CHECK: Serum program ID
    pub serum_program_id: AccountInfo<'info>,
    
    /// CHECK: Serum market
    #[account(mut)]
    pub serum_market: AccountInfo<'info>,
    
    /// CHECK: Serum bids
    #[account(mut)]
    pub serum_bids: AccountInfo<'info>,
    
    /// CHECK: Serum asks
    #[account(mut)]
    pub serum_asks: AccountInfo<'info>,
    
    /// CHECK: Serum event queue
    #[account(mut)]
    pub serum_event_queue: AccountInfo<'info>,
    
    /// CHECK: Serum coin vault
    #[account(mut)]
    pub serum_coin_vault_account: AccountInfo<'info>,
    
    /// CHECK: Serum PC vault
    #[account(mut)]
    pub serum_pc_vault_account: AccountInfo<'info>,
    
    /// CHECK: Serum vault signer
    pub serum_vault_signer: AccountInfo<'info>,
    
    #[account(mut)]
    pub user_source_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_destination_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_owner: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}
