#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, token, Address, Env, String, Vec};

/// Fatura/makbuz durumu.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Status {
    Pending = 0,
    Paid = 1,
    Cancelled = 2,
}

/// Tek bir fatura kaydı. Ödeme yapılınca aynı kayıt makbuza dönüşür.
#[contracttype]
#[derive(Clone)]
pub struct Invoice {
    pub id: u64,
    pub merchant: Address,
    pub payer: Option<Address>,
    pub token: Address,
    pub amount: i128,
    pub memo: String,
    pub status: Status,
    pub created_at: u64,
    pub paid_at: u64,
}

#[contracttype]
enum DataKey {
    Counter,
    Invoice(u64),
    Merchant(Address),
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Error {
    NotFound = 1,
    NotPending = 2,
    InvalidAmount = 3,
}

#[contract]
pub struct ReceiptContract;

#[contractimpl]
impl ReceiptContract {}
