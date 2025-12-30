use anchor_lang::prelude::*;

declare_id!("HVzFARcGZFJ4y5mRcGDk6DNuwomWzVXfRevQSnUBT5ws");

#[program]
pub mod atomic_round_trip {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
