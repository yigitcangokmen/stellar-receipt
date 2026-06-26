// stellar-sdk ve wallet-kit, yüklenirken Buffer/global bekliyor.
// Bu dosya main.tsx'te EN ÖNCE import edilir ki diğer modüller yüklenmeden global'ler hazır olsun.
import { Buffer } from 'buffer'

;(globalThis as any).Buffer = (globalThis as any).Buffer || Buffer
;(globalThis as any).global = (globalThis as any).global || globalThis
