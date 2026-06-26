import { Buffer } from "buffer";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u64,
  i128,
  Option,
} from "@stellar/stellar-sdk/contract";
if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCHPF5XGHHACLD5BBYWONSJTYLOJHE5WYRUPZ37FRNBETYHRENAJRZCI",
  }
} as const

export const Errors = {
  1: {message:"NotFound"},
  2: {message:"NotPending"},
  3: {message:"InvalidAmount"}
}

/**
 * Fatura/makbuz durumu.
 */
export enum Status {
  Pending = 0,
  Paid = 1,
  Cancelled = 2,
}


/**
 * Tek bir fatura kaydı. Ödeme yapılınca aynı kayıt makbuza dönüşür.
 */
export interface Invoice {
  amount: i128;
  created_at: u64;
  id: u64;
  memo: string;
  merchant: string;
  paid_at: u64;
  payer: Option<string>;
  status: Status;
  token: string;
}

export interface Client {
  /**
   * Construct and simulate a get_invoice transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Bir faturayı/makbuzu id ile getirir (doğrulama için herkese açık).
   */
  get_invoice: ({invoice_id}: {invoice_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Invoice>>>

  /**
   * Construct and simulate a pay_invoice transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Ödeyen faturayı öder: token transferi yapılır ve kayıt PAID olur (makbuz).
   */
  pay_invoice: ({invoice_id, payer}: {invoice_id: u64, payer: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a cancel_invoice transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Satıcı, ödenmemiş bir faturayı iptal edebilir.
   */
  cancel_invoice: ({invoice_id}: {invoice_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_invoice transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Satıcı yeni bir fatura oluşturur. Fatura id'sini döner.
   */
  create_invoice: ({merchant, token, amount, memo}: {merchant: string, token: string, amount: i128, memo: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a list_by_merchant transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Bir satıcının tüm fatura id'lerini döner.
   */
  list_by_merchant: ({merchant}: {merchant: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAAwAAAAAAAAAITm90Rm91bmQAAAABAAAAAAAAAApOb3RQZW5kaW5nAAAAAAACAAAAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAAAw==",
        "AAAAAwAAABVGYXR1cmEvbWFrYnV6IGR1cnVtdS4AAAAAAAAAAAAABlN0YXR1cwAAAAAAAwAAAAAAAAAHUGVuZGluZwAAAAAAAAAAAAAAAARQYWlkAAAAAQAAAAAAAAAJQ2FuY2VsbGVkAAAAAAAAAg==",
        "AAAAAQAAAEtUZWsgYmlyIGZhdHVyYSBrYXlkxLEuIMOWZGVtZSB5YXDEsWzEsW5jYSBheW7EsSBrYXnEsXQgbWFrYnV6YSBkw7Zuw7zFn8O8ci4AAAAAAAAAAAdJbnZvaWNlAAAAAAkAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAKY3JlYXRlZF9hdAAAAAAABgAAAAAAAAACaWQAAAAAAAYAAAAAAAAABG1lbW8AAAAQAAAAAAAAAAhtZXJjaGFudAAAABMAAAAAAAAAB3BhaWRfYXQAAAAABgAAAAAAAAAFcGF5ZXIAAAAAAAPoAAAAEwAAAAAAAAAGc3RhdHVzAAAAAAfQAAAABlN0YXR1cwAAAAAAAAAAAAV0b2tlbgAAAAAAABM=",
        "AAAAAAAAAEdCaXIgZmF0dXJhecSxL21ha2J1enUgaWQgaWxlIGdldGlyaXIgKGRvxJ9ydWxhbWEgacOnaW4gaGVya2VzZSBhw6fEsWspLgAAAAALZ2V0X2ludm9pY2UAAAAAAQAAAAAAAAAKaW52b2ljZV9pZAAAAAAABgAAAAEAAAPpAAAH0AAAAAdJbnZvaWNlAAAAAAM=",
        "AAAAAAAAAFDDlmRleWVuIGZhdHVyYXnEsSDDtmRlcjogdG9rZW4gdHJhbnNmZXJpIHlhcMSxbMSxciB2ZSBrYXnEsXQgUEFJRCBvbHVyIChtYWtidXopLgAAAAtwYXlfaW52b2ljZQAAAAACAAAAAAAAAAppbnZvaWNlX2lkAAAAAAAGAAAAAAAAAAVwYXllcgAAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAADNTYXTEsWPEsSwgw7ZkZW5tZW1pxZ8gYmlyIGZhdHVyYXnEsSBpcHRhbCBlZGViaWxpci4AAAAADmNhbmNlbF9pbnZvaWNlAAAAAAABAAAAAAAAAAppbnZvaWNlX2lkAAAAAAAGAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAADtTYXTEsWPEsSB5ZW5pIGJpciBmYXR1cmEgb2x1xZ90dXJ1ci4gRmF0dXJhIGlkJ3NpbmkgZMO2bmVyLgAAAAAOY3JlYXRlX2ludm9pY2UAAAAAAAQAAAAAAAAACG1lcmNoYW50AAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAABG1lbW8AAAAQAAAAAQAAA+kAAAAGAAAAAw==",
        "AAAAAAAAAC5CaXIgc2F0xLFjxLFuxLFuIHTDvG0gZmF0dXJhIGlkJ2xlcmluaSBkw7ZuZXIuAAAAAAAQbGlzdF9ieV9tZXJjaGFudAAAAAEAAAAAAAAACG1lcmNoYW50AAAAEwAAAAEAAAPqAAAABg==" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_invoice: this.txFromJSON<Result<Invoice>>,
        pay_invoice: this.txFromJSON<Result<void>>,
        cancel_invoice: this.txFromJSON<Result<void>>,
        create_invoice: this.txFromJSON<Result<u64>>,
        list_by_merchant: this.txFromJSON<Array<u64>>
  }
}