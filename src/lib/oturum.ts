// Panel kimlik doğrulama: tek şifre, imzalı ve süreli oturum çerezi.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { ayarlar } from './ayarlar'

export const CEREZ = 'panel_oturumu'
export const OTURUM_SANIYE = 12 * 60 * 60

const esit = (a: string, b: string) =>
  // Uzunluk farkı da sızmasın diye önce sabit boyutlu özete çevrilir.
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())

const imza = (bitis: string) => createHmac('sha256', ayarlar().oturumAnahtari).update('oturum:' + bitis).digest('hex')

export const sifreDogru = (girilen: string) => esit(girilen, ayarlar().panelSifresi)

// shortcut: oturum durumsuz, çıkış yalnız çerezi siler; çalınmış bir çerez süresi dolana kadar geçerlidir.
// Tek tek oturum iptali gerekirse oturumlar veritabanına taşınmalı.
export function oturumOlustur(simdi = Date.now()): string {
  const bitis = String(simdi + OTURUM_SANIYE * 1000)
  return `${bitis}.${imza(bitis)}`
}

export function oturumGecerli(deger: string | undefined, simdi = Date.now()): boolean {
  if (!deger) return false
  const [bitis, im] = deger.split('.')
  if (!bitis || !im || !/^\d+$/.test(bitis)) return false
  return esit(im, imza(bitis)) && Number(bitis) > simdi
}
