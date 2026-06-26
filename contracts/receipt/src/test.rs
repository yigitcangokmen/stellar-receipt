#![cfg(test)]
use super::*;
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events},
    token, Address, Env, String, Symbol, TryFromVal,
};

fn setup() -> (Env, ReceiptContractClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ReceiptContract, ());
    let client = ReceiptContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = sac.address();

    (env, client, admin, token_address)
}

#[test]
fn create_and_get_invoice() {
    let (env, client, _admin, token) = setup();
    let merchant = Address::generate(&env);

    let id = client.create_invoice(&merchant, &token, &100, &String::from_str(&env, "Design work"));
    assert_eq!(id, 1);

    let inv = client.get_invoice(&id);
    assert_eq!(inv.merchant, merchant);
    assert_eq!(inv.amount, 100);
    assert_eq!(inv.status, Status::Pending);
    assert_eq!(inv.payer, None);
}

#[test]
fn pay_invoice_transfers_and_marks_paid() {
    let (env, client, admin, token) = setup();
    let merchant = Address::generate(&env);
    let payer = Address::generate(&env);

    // Ödeyene bakiye mint et.
    let token_admin = token::StellarAssetClient::new(&env, &token);
    token_admin.mint(&payer, &500);

    let id = client.create_invoice(&merchant, &token, &100, &String::from_str(&env, "Invoice"));
    client.pay_invoice(&id, &payer);

    let inv = client.get_invoice(&id);
    assert_eq!(inv.status, Status::Paid);
    assert_eq!(inv.payer, Some(payer.clone()));
    assert!(inv.paid_at >= inv.created_at);

    // Token gerçekten transfer edildi mi?
    let token_client = token::Client::new(&env, &token);
    assert_eq!(token_client.balance(&merchant), 100);
    assert_eq!(token_client.balance(&payer), 400);
    let _ = admin;
}

#[test]
fn cannot_pay_twice() {
    let (env, client, _admin, token) = setup();
    let merchant = Address::generate(&env);
    let payer = Address::generate(&env);
    let token_admin = token::StellarAssetClient::new(&env, &token);
    token_admin.mint(&payer, &500);

    let id = client.create_invoice(&merchant, &token, &100, &String::from_str(&env, "x"));
    client.pay_invoice(&id, &payer);

    let res = client.try_pay_invoice(&id, &payer);
    assert_eq!(res, Err(Ok(Error::NotPending)));
}

#[test]
fn cancel_pending_invoice() {
    let (env, client, _admin, token) = setup();
    let merchant = Address::generate(&env);

    let id = client.create_invoice(&merchant, &token, &100, &String::from_str(&env, "x"));
    client.cancel_invoice(&id);

    let inv = client.get_invoice(&id);
    assert_eq!(inv.status, Status::Cancelled);
}

#[test]
fn cannot_cancel_paid_invoice() {
    let (env, client, _admin, token) = setup();
    let merchant = Address::generate(&env);
    let payer = Address::generate(&env);
    let token_admin = token::StellarAssetClient::new(&env, &token);
    token_admin.mint(&payer, &500);

    let id = client.create_invoice(&merchant, &token, &100, &String::from_str(&env, "x"));
    client.pay_invoice(&id, &payer);

    let res = client.try_cancel_invoice(&id);
    assert_eq!(res, Err(Ok(Error::NotPending)));
}

#[test]
fn reject_non_positive_amount() {
    let (env, client, _admin, token) = setup();
    let merchant = Address::generate(&env);

    let res = client.try_create_invoice(&merchant, &token, &0, &String::from_str(&env, "x"));
    assert_eq!(res, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn list_by_merchant_returns_ids() {
    let (env, client, _admin, token) = setup();
    let merchant = Address::generate(&env);

    client.create_invoice(&merchant, &token, &10, &String::from_str(&env, "a"));
    client.create_invoice(&merchant, &token, &20, &String::from_str(&env, "b"));

    let ids = client.list_by_merchant(&merchant);
    assert_eq!(ids.len(), 2);
    assert_eq!(ids.get(0), Some(1));
    assert_eq!(ids.get(1), Some(2));
}

#[test]
fn pay_emits_paid_event() {
    let (env, client, _admin, token) = setup();
    let merchant = Address::generate(&env);
    let payer = Address::generate(&env);
    token::StellarAssetClient::new(&env, &token).mint(&payer, &500);

    let id = client.create_invoice(&merchant, &token, &100, &String::from_str(&env, "x"));
    client.pay_invoice(&id, &payer);

    // Son yayınlanan event bizim contract'tan, topic'i ('paid', id), datası payer olmalı.
    let all = env.events().all();
    let (contract_addr, topics, data) = all.last().expect("no event emitted");
    assert_eq!(contract_addr, client.address);

    let t0 = Symbol::try_from_val(&env, &topics.get(0).unwrap()).unwrap();
    let t1 = u64::try_from_val(&env, &topics.get(1).unwrap()).unwrap();
    let paid_by = Address::try_from_val(&env, &data).unwrap();
    assert_eq!(t0, symbol_short!("paid"));
    assert_eq!(t1, id);
    assert_eq!(paid_by, payer);
}

#[test]
fn pay_with_insufficient_balance_reverts() {
    let (env, client, _admin, token) = setup();
    let merchant = Address::generate(&env);
    let payer = Address::generate(&env);
    token::StellarAssetClient::new(&env, &token).mint(&payer, &50); // 50 < 100

    let id = client.create_invoice(&merchant, &token, &100, &String::from_str(&env, "x"));
    let res = client.try_pay_invoice(&id, &payer);
    assert!(res.is_err());

    // Atomiklik: transfer başarısız olunca state geri alınmalı (fatura PENDING kalır).
    let inv = client.get_invoice(&id);
    assert_eq!(inv.status, Status::Pending);
    assert_eq!(inv.payer, None);
}

#[test]
fn list_isolated_per_merchant() {
    let (env, client, _admin, token) = setup();
    let m1 = Address::generate(&env);
    let m2 = Address::generate(&env);

    client.create_invoice(&m1, &token, &10, &String::from_str(&env, "a"));
    client.create_invoice(&m2, &token, &20, &String::from_str(&env, "b"));
    client.create_invoice(&m1, &token, &30, &String::from_str(&env, "c"));

    let l1 = client.list_by_merchant(&m1);
    let l2 = client.list_by_merchant(&m2);
    assert_eq!(l1.len(), 2);
    assert_eq!(l2.len(), 1);
    assert_eq!(l1.get(0), Some(1));
    assert_eq!(l1.get(1), Some(3));
    assert_eq!(l2.get(0), Some(2));
}
