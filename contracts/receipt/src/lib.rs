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
impl ReceiptContract {
    /// Satıcı yeni bir fatura oluşturur. Fatura id'sini döner.
    pub fn create_invoice(
        env: Env,
        merchant: Address,
        token: Address,
        amount: i128,
        memo: String,
    ) -> Result<u64, Error> {
        merchant.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let id = env
            .storage()
            .instance()
            .get(&DataKey::Counter)
            .unwrap_or(0u64)
            + 1;
        env.storage().instance().set(&DataKey::Counter, &id);

        let invoice = Invoice {
            id,
            merchant: merchant.clone(),
            payer: None,
            token,
            amount,
            memo,
            status: Status::Pending,
            created_at: env.ledger().timestamp(),
            paid_at: 0,
        };
        env.storage().persistent().set(&DataKey::Invoice(id), &invoice);

        // Satıcıya ait fatura indeksine ekle (listeleme için).
        let mut ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::Merchant(merchant.clone()))
            .unwrap_or(Vec::new(&env));
        ids.push_back(id);
        env.storage()
            .persistent()
            .set(&DataKey::Merchant(merchant), &ids);

        Ok(id)
    }
}
