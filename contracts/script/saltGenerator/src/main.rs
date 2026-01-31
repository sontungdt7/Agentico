use alloy_primitives::{Address, B256};
use clap::Parser;
use spinners::{Spinner, Spinners};
use std::str::FromStr;
use std::sync::{Arc, RwLock};
use std::thread;
use address_miner::{mine_salt, mine_salt_for_address, abi_encode_sender_and_salt};

#[derive(Parser)]
#[command(about = "Salt miner for strategy deployment (hooks or FullRangeLBPStrategy)", long_about = None)]
struct Cli {
    init_code_hash: Option<String>,
    hook_permissions_mask: Option<String>,
    #[arg(short, long, value_name = "MSG_SENDER")]
    msg_sender: Option<String>,
    #[arg(short, long, value_name = "STRATEGY_FACTORY_ADDRESS")]
    strategy_address: Option<String>,
    #[arg(short = 'l', long, value_name = "TOKEN_LAUNCHER_ADDRESS")]
    token_launcher_address: Option<String>,
    #[arg(
        short = 'n',
        long,
        value_name = "NUMBER_OF_THREADS",
        default_value_t = 8
    )]
    threads: i32,
    #[arg(short = 'p', long, value_name = "VANITY_PREFIX")]
    vanity_prefix: Option<String>,
    #[arg(short = 'a', long, value_name = "TARGET_ADDRESS")]
    target_address: Option<String>,
    #[arg(short = 'c', long)]
    case_sensitive: bool,
    #[arg(short = 'q', long)]
    quiet: bool
}

fn main() {
    let cli = Cli::parse();
    let mut msg_sender_address: Address = Address::ZERO;
    let mut strategy_address: Address = Address::ZERO;
    let mut token_launcher_address: Address = Address::ZERO;
    let mut init_code_hash: B256 = B256::ZERO;
    let mut hook_permissions_mask: Option<Address> = None;
    let mut target_address: Option<Address> = None;
    let threads = cli.threads;
    let case_sensitive = cli.case_sensitive;
    let quiet = cli.quiet;

    // Parse the command line arguments
    if let Some(_msg_sender) = cli.msg_sender.as_deref() {
        msg_sender_address =
            Address::from_str(_msg_sender).expect("Error: Invalid deployer address");
    }
    if let Some(_init_code_hash) = cli.init_code_hash.as_deref() {
        init_code_hash = B256::from_str(_init_code_hash).expect("Error: Invalid init code hash");
    }
    if let Some(_strategy_address) = cli.strategy_address.as_deref() {
        strategy_address =
            Address::from_str(_strategy_address).expect("Error: Invalid strategy address");
    }
    if let Some(_token_launcher_address) = cli.token_launcher_address.as_deref() {
        token_launcher_address =
            Address::from_str(_token_launcher_address).expect("Error: Invalid token launcher address");
    }
    if let Some(_mask) = cli.hook_permissions_mask.as_deref() {
        hook_permissions_mask = Some(
            Address::from_str(_mask).expect("Error: Invalid hook permission mask")
        );
    }
    if let Some(_target) = cli.target_address.as_deref() {
        target_address = Some(
            Address::from_str(_target).expect("Error: Invalid target address")
        );
    }
    let vanity_prefix = cli.vanity_prefix.clone().unwrap_or_default();

    // Validate the command line arguments
    if msg_sender_address == Address::ZERO {
        eprintln!("Error: Invalid msg_sender address");
        std::process::exit(1);
    }
    if init_code_hash == B256::ZERO {
        eprintln!("Error: Invalid initialization code hash");
        std::process::exit(1);
    }
    if strategy_address == Address::ZERO {
        eprintln!("Error: Invalid strategy address");
        std::process::exit(1);
    }
    if token_launcher_address == Address::ZERO {
        eprintln!("Error: Invalid token launcher address");
        std::process::exit(1);
    }
    // Validate that at least one matching criteria is provided
    if hook_permissions_mask.is_none() && target_address.is_none() && vanity_prefix.is_empty() {
        eprintln!("Error: Must provide either --hook-permissions-mask, --target-address, or --vanity-prefix");
        std::process::exit(1);
    }
    if !vanity_prefix.is_empty() && usize::from_str_radix(&vanity_prefix, 16).is_err() {
        eprintln!("Error: Invalid hex vanity prefix");
        std::process::exit(1);
    }

    // Print run properties
    if !quiet {
        println!("Run properties:");
        println!(" * Msg sender address: {:?}", &msg_sender_address);
        println!(" * Init code hash: {:?}", &init_code_hash);
        if let Some(ref mask) = hook_permissions_mask {
            println!(" * Hook permissions mask: {:?}", mask);
        }
        if let Some(ref target) = target_address {
            println!(" * Target address: {:?}", target);
        }
        if !vanity_prefix.is_empty() {
            println!(" * Vanity prefix: {:?}", &vanity_prefix);
        }
        println!(" * Strategy address: {:?}", &strategy_address);
        println!(" * Token launcher address: {:?}", &token_launcher_address);
        println!(" * Number of threads: {}", threads);
        println!();
    }

    // Start Mining
    
    let mut sp: Option<Spinner> = if !quiet {
        Some(Spinner::new(Spinners::Aesthetic, "Mining...".into()))
    } else {
        None 
    };
    let shared_salt = Arc::new(RwLock::new(Option::<B256>::None));
    let mut handles = vec![];
    for _ in 0..threads {
        let shared_salt_clone = Arc::clone(&shared_salt);
        let vanity_prefix_clone = vanity_prefix.clone();
        let hook_mask_clone = hook_permissions_mask;
        let target_addr_clone = target_address;

        let handle = thread::spawn(move || {
            while shared_salt_clone.read().unwrap().is_none() {
                let salt = if hook_mask_clone.is_some() {
                    // Use hook permissions mask mining
                    mine_salt(strategy_address, init_code_hash, hook_mask_clone, msg_sender_address, token_launcher_address)
                } else {
                    // Use vanity/target address mining
                    mine_salt_for_address(
                        strategy_address,
                        init_code_hash,
                        msg_sender_address,
                        token_launcher_address,
                        target_addr_clone,
                        &vanity_prefix_clone,
                        case_sensitive,
                    )
                };
                
                *shared_salt_clone.write().unwrap() = Some(salt);
            }
        });

        handles.push(handle);
    }

    // Wait for all threads to complete
    for handle in handles {
        handle.join().unwrap();
    }
    // If not quiet then the spinner will be some and we should stop it
    if let Some(ref mut spinner) = sp { spinner.stop() };

    // Print results
    let salt = shared_salt.read().unwrap().unwrap();
    let salt_with_msg_sender = abi_encode_sender_and_salt(msg_sender_address, salt);
    let salt_with_token_launcher = abi_encode_sender_and_salt(token_launcher_address, salt_with_msg_sender);
    let final_address = strategy_address.create2(salt_with_token_launcher, init_code_hash);
    
    if !quiet {
        println!("\n\nSalt Found!");
        println!(" * Salt: {:?}", salt);
        println!(" * Salt (hex): {}", salt);
        println!(" * Final deployment address: {}", final_address.to_checksum(None));
    } else {
        println!("{}", salt);
    }
}