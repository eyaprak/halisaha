// Koruma katmanı: gerçek istemci IP'si, IP özeti, hız limiti, takım adı doğrulama.
import { createHmac } from 'node:crypto'

/**
 * Sunucumuz (server.mjs) her istekte soket adresini X-Forwarded-For zincirinin sonuna ekler.
 * Sondaki `vekilSayisi` kadar adres güvendiğimiz vekillere aittir; onlardan bir önceki
 * gerçek istemcidir. Daha soldaki değerleri istemci uydurabilir, o yüzden okunmaz.
 */
export function istemciIp(xff: string | null, vekilSayisi: number): string {
  const zincir = (xff ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return zincir[Math.max(0, zincir.length - 1 - vekilSayisi)] ?? 'bilinmiyor'
}

/** Sınırların uygulanacağı anahtar: IPv4 adresi ya da IPv6 /64 bloğu. */
export function ipAnahtari(ip: string): string {
  const v4 = ip.replace(/^::ffff:/i, '')
  if (!v4.includes(':')) return v4
  // IPv6'da tek abone /64 bloğunun tamamını kullanabilir; adres başına sınır anlamsız kalır.
  const [bas, son] = ip.split('::')
  const b = bas ? bas.split(':') : []
  const s = son ? son.split(':') : []
  const tam = ip.includes('::') ? [...b, ...Array(Math.max(0, 8 - b.length - s.length)).fill('0'), ...s] : b
  return tam.slice(0, 4).map((h) => (parseInt(h, 16) || 0).toString(16)).join(':') + '::/64'
}

/** IP düz saklanmaz; yalnız gizli anahtarla alınmış özeti saklanır. */
export function ipOzeti(ip: string, anahtar: string): string {
  return createHmac('sha256', anahtar).update('ip:' + ipAnahtari(ip)).digest('hex')
}

// ---- Hız limiti (kayan pencere) ----
// shortcut: sayaçlar süreç belleğinde, yeniden başlatmada sıfırlanır ve tek süreç varsayar;
// uygulama birden çok kopya çalışacaksa PostgreSQL ya da Redis'e taşınmalı.
const g = globalThis as unknown as { __hizSayaclari?: Map<string, number[]> }
const sayaclar = (g.__hizSayaclari ??= new Map<string, number[]>())
const EN_UZUN_PENCERE = 15 * 60_000

/** Penceredeki kayıt sayısı (tüketmez). */
export function hizSayisi(anahtar: string, pencereMs: number, simdi = Date.now()): number {
  return (sayaclar.get(anahtar) ?? []).filter((t) => t > simdi - pencereMs).length
}

export function hizEkle(anahtar: string, simdi = Date.now()): void {
  const liste = (sayaclar.get(anahtar) ?? []).filter((t) => t > simdi - EN_UZUN_PENCERE)
  liste.push(simdi)
  sayaclar.set(anahtar, liste)
}

/** Sınır dolmuşsa true döner; dolmamışsa isteği sayar. */
export function hizAsildi(anahtar: string, limit: number, pencereMs: number): boolean {
  if (hizSayisi(anahtar, pencereMs) >= limit) return true
  hizEkle(anahtar)
  return false
}

// Süresi dolan anahtarlar bellekte birikmesin.
const temizlik = setInterval(() => {
  const esik = Date.now() - EN_UZUN_PENCERE
  for (const [k, v] of sayaclar) if (!v.some((t) => t > esik)) sayaclar.delete(k)
}, 60_000)
temizlik.unref?.()

// ---- Takım adı ----
const HARF_ESLEME: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u',
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i',
}
// Kelimenin neresinde geçerse geçsin reddedilen kökler. Boşluksuz, sadeleştirilmiş metinde
// aranır ("s i k t i r" de yakalansın); tekrarlı harf içermeyecek biçimde yazılır.
const YASAK_KOKLER = [
  'orospu', 'orosbu', 'siktir', 'sikerim', 'sikeyim', 'sikik', 'amcik', 'aminako', 'yarak', 'yarag',
  'pezevenk', 'kahpe', 'kaltak', 'ibne', 'gavat', 'godos', 'pust', 'serefsiz', 'tasak', 'gotveren',
  'fuck', 'bitch', 'porno', 'penis', 'vajina', 'hitler',
]
// Kısa ya da masum sözcüklerin içinde geçtiği için yalnız tek başına kelime olarak reddedilenler
// ("klasik", "götür", "vitamini", "Nazilli" takılmasın).
const YASAK_KELIMELER = new Set([
  'sik', 'am', 'got', 'pic', 'oc', 'aq', 'amk', 'amq', 'mk', 'sg', 'amina', 'amini', 'sex', 'seks', 'dick',
  'shit', 'porn', 'nazi', 'niga', 'niger',
])

const sade = (s: string) =>
  [...s.toLocaleLowerCase('tr')]
    .map((c) => HARF_ESLEME[c] ?? c)
    .join('')
    .normalize('NFD')
    .replace(/[^a-z ]/g, '')
    .replace(/(.)\1+/g, '$1') // tekrarlanan harfleri teke indir: "siiik" -> "sik"

// shortcut: küçük gömülü liste her varyasyonu yakalamaz ve nadiren masum bir adı reddeder;
// kaçanlar için son savunma işletmeci iptalidir.
export function uygunsuz(metin: string): boolean {
  const s = sade(metin)
  if (s.split(' ').some((k) => YASAK_KELIMELER.has(k))) return true
  const bitisik = s.replace(/ /g, '')
  return YASAK_KOKLER.some((k) => bitisik.includes(k))
}

const BAGLANTI = /(https?|www\.|\.(com|net|org|io|co|tr|me|ly|gg|xyz|app|tv|ru|biz|info|link|site|online)(?![\p{L}\p{N}]))/iu
// Yalnız Latin harfleri: başka alfabelerdeki benzer harflerle filtre atlatılamasın.
const IZINLI = /^[\p{Script=Latin}0-9 .,'&!+-]+$/u

export function takimAdiDogrula(ham: unknown): { ok: true; ad: string } | { ok: false; mesaj: string } {
  if (typeof ham !== 'string') return { ok: false, mesaj: 'Takım adı gerekli.' }
  const ad = ham.normalize('NFKC').replace(/\s+/g, ' ').trim()
  const uzunluk = [...ad].length
  if (uzunluk < 2 || uzunluk > 24) return { ok: false, mesaj: 'Takım adı 2 ile 24 karakter arasında olmalı.' }
  if (!IZINLI.test(ad)) return { ok: false, mesaj: 'Takım adında yalnız harf, rakam, boşluk ve . , \' & ! + - kullanılabilir.' }
  if (!/[\p{L}0-9]/u.test(ad)) return { ok: false, mesaj: 'Takım adında en az bir harf ya da rakam olmalı.' }
  if (BAGLANTI.test(ad)) return { ok: false, mesaj: 'Takım adında bağlantı olamaz.' }
  if (uygunsuz(ad)) return { ok: false, mesaj: 'Bu takım adı uygun değil. Başka bir ad dene.' }
  return { ok: true, ad }
}
