use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Token, TokenAccount};

declare_id!("HVzFARcGZFJ4y5mRcGDk6DNuwomWzVXfRevQSnUBT5ws");

#[program]
pub mod atomic_round_trip {
    use super::*;

    pub fn atomic_round_trip(
        ctx: Context<AtomicRoundTrip>,
        amount_in: u64,
        min_out_buy: u64,
        min_out_sell: u64,
    ) -> Result<()> {
        require!(ctx.accounts.payer.is_signer, ErrorCode::Unauthorized);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AtomicRoundTrip<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub user_token_a: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_b: Account<'info, TokenAccount>,
    /// CHECK: Generic AMM account passed in
    pub amm_account: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized")]
    Unauthorized,
}
