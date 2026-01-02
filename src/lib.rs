use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    instruction::{AccountMeta, Instruction},
    system_instruction,
};
use borsh::{BorshDeserialize, BorshSerialize};

entrypoint!(process_instruction);

// Devnet Raydium AMM Program ID
const DEVNET_RAYDIUM_AMM: &str = "HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8";

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct AtomicSwapInstruction {
    pub amount_in: u64,
    pub minimum_amount_out_buy: u64,
    pub minimum_amount_out_sell: u64,
}

pub fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = AtomicSwapInstruction::try_from_slice(instruction_data)?;
    
    let account_info_iter = &mut accounts.iter();
    
    // Raydium and Serum accounts
    let raydium_program = next_account_info(account_info_iter)?;
    
    // Validate Raydium program ID for devnet
    let expected_raydium = DEVNET_RAYDIUM_AMM.parse::<Pubkey>().unwrap();
    if *raydium_program.key != expected_raydium {
        msg!("Invalid Raydium program ID. Expected: {}, Got: {}", DEVNET_RAYDIUM_AMM, raydium_program.key);
        return Err(ProgramError::InvalidAccountData);
    }
    
    let amm_id = next_account_info(account_info_iter)?;
    let amm_authority = next_account_info(account_info_iter)?;
    let amm_open_orders = next_account_info(account_info_iter)?;
    let amm_target_orders = next_account_info(account_info_iter)?;
    let pool_coin_token_account = next_account_info(account_info_iter)?;
    let pool_pc_token_account = next_account_info(account_info_iter)?;
    let serum_program_id = next_account_info(account_info_iter)?;
    let serum_market = next_account_info(account_info_iter)?;
    let serum_bids = next_account_info(account_info_iter)?;
    let serum_asks = next_account_info(account_info_iter)?;
    let serum_event_queue = next_account_info(account_info_iter)?;
    let serum_coin_vault_account = next_account_info(account_info_iter)?;
    let serum_pc_vault_account = next_account_info(account_info_iter)?;
    let serum_vault_signer = next_account_info(account_info_iter)?;
    let user_source_token_account = next_account_info(account_info_iter)?;
    let user_destination_token_account = next_account_info(account_info_iter)?;
    let user_source_owner = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;

    msg!("Starting atomic round-trip swap with devnet Raydium");

    // Buy: SOL -> Token
    let buy_accounts = vec![
        AccountMeta::new_readonly(*amm_id.key, false),
        AccountMeta::new_readonly(*amm_authority.key, false),
        AccountMeta::new(*amm_open_orders.key, false),
        AccountMeta::new(*amm_target_orders.key, false),
        AccountMeta::new(*pool_coin_token_account.key, false),
        AccountMeta::new(*pool_pc_token_account.key, false),
        AccountMeta::new_readonly(*serum_program_id.key, false),
        AccountMeta::new(*serum_market.key, false),
        AccountMeta::new(*serum_bids.key, false),
        AccountMeta::new(*serum_asks.key, false),
        AccountMeta::new(*serum_event_queue.key, false),
        AccountMeta::new(*serum_coin_vault_account.key, false),
        AccountMeta::new(*serum_pc_vault_account.key, false),
        AccountMeta::new_readonly(*serum_vault_signer.key, false),
        AccountMeta::new(*user_source_token_account.key, false),
        AccountMeta::new(*user_destination_token_account.key, false),
        AccountMeta::new_readonly(*user_source_owner.key, true),
        AccountMeta::new_readonly(*token_program.key, false),
    ];

    let mut buy_data = vec![9]; // Raydium swap instruction
    buy_data.extend_from_slice(&instruction.amount_in.to_le_bytes());
    buy_data.extend_from_slice(&instruction.minimum_amount_out_buy.to_le_bytes());

    let buy_ix = Instruction {
        program_id: *raydium_program.key,
        accounts: buy_accounts,
        data: buy_data,
    };

    invoke(&buy_ix, accounts)?;
    msg!("Buy swap completed");

    // Get token balance after buy
    let token_account_data = user_destination_token_account.try_borrow_data()?;
    let token_balance = u64::from_le_bytes([
        token_account_data[64], token_account_data[65], token_account_data[66], token_account_data[67],
        token_account_data[68], token_account_data[69], token_account_data[70], token_account_data[71],
    ]);
    drop(token_account_data);

    // Sell: Token -> SOL (reverse the coin/pc accounts)
    let sell_accounts = vec![
        AccountMeta::new_readonly(*amm_id.key, false),
        AccountMeta::new_readonly(*amm_authority.key, false),
        AccountMeta::new(*amm_open_orders.key, false),
        AccountMeta::new(*amm_target_orders.key, false),
        AccountMeta::new(*pool_pc_token_account.key, false),
        AccountMeta::new(*pool_coin_token_account.key, false),
        AccountMeta::new_readonly(*serum_program_id.key, false),
        AccountMeta::new(*serum_market.key, false),
        AccountMeta::new(*serum_asks.key, false),
        AccountMeta::new(*serum_bids.key, false),
        AccountMeta::new(*serum_event_queue.key, false),
        AccountMeta::new(*serum_pc_vault_account.key, false),
        AccountMeta::new(*serum_coin_vault_account.key, false),
        AccountMeta::new_readonly(*serum_vault_signer.key, false),
        AccountMeta::new(*user_destination_token_account.key, false),
        AccountMeta::new(*user_source_token_account.key, false),
        AccountMeta::new_readonly(*user_source_owner.key, true),
        AccountMeta::new_readonly(*token_program.key, false),
    ];

    let mut sell_data = vec![9]; // Raydium swap instruction
    sell_data.extend_from_slice(&token_balance.to_le_bytes());
    sell_data.extend_from_slice(&instruction.minimum_amount_out_sell.to_le_bytes());

    let sell_ix = Instruction {
        program_id: *raydium_program.key,
        accounts: sell_accounts,
        data: sell_data,
    };

    invoke(&sell_ix, accounts)?;
    msg!("Sell swap completed - atomic round-trip successful");

    Ok(())
}
