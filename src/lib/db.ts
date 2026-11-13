import { Pool } from 'pg'
import { ayarlar } from './ayarlar'
import { cekirdekOlustur, type Cekirdek } from './cekirdek'

// Geliştirme modunda modüller yeniden yüklenince havuz çoğalmasın diye globalde tutulur.
const g = globalThis as unknown as { __pool?: Pool; __cekirdek?: Cekirdek }

/** Bağlantı bilgisi standart PG* ortam değişkenlerinden okunur. */
export function havuz(): Pool {
  return (g.__pool ??= new Pool({ max: 10, connectionTimeoutMillis: 5000 }))
}

export function cekirdek(): Cekirdek {
  const a = ayarlar()
  return (g.__cekirdek ??= cekirdekOlustur(havuz(), {
    acilis: a.acilis,
    kapanis: a.kapanis,
    gunSayisi: a.gunSayisi,
    ipSiniri: a.ipSiniri,
    ozetAnahtari: a.ipOzetAnahtari,
  }))
}
