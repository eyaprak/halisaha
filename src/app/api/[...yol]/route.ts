// Bütün API uçları tek tabloda. Bu dosya ince bir katmandır: kaynak denetimi, hız limiti,
// oturum ve gövde sınırını uygular; iş kuralları çekirdektedir.
import { NextResponse, type NextRequest } from 'next/server'
import { ayarlar } from '@/lib/ayarlar'
import { cekirdek, havuz } from '@/lib/db'
import { hizAsildi, hizEkle, hizSayisi, ipOzeti, istemciIp, takimAdiDogrula } from '@/lib/koruma'
import { CEREZ, OTURUM_SANIYE, oturumGecerli, oturumOlustur, sifreDogru } from '@/lib/oturum'
import { istanbul } from '@/lib/zaman'

export const dynamic = 'force-dynamic'

const GOVDE_SINIRI = 4096
const DAKIKA = 60_000

const MESAJLAR: Record<string, [durum: number, mesaj: string]> = {
  gecersiz: [400, 'Geçersiz istek.'],
  bozuk: [400, 'Geçersiz istek.'],
  ad: [400, 'Takım adı uygun değil.'],
  pencere_disi: [400, 'Bu gün rezervasyona açık değil.'],
  gecmis_saat: [400, 'Bu saat geçti.'],
  sifre: [401, 'Şifre yanlış.'],
  oturum: [401, 'Oturum gerekli.'],
  kaynak: [403, 'İstek reddedildi.'],
  yetkisiz: [403, 'Bu işlem bu kodla yapılamaz.'],
  sinir: [403, 'Rezervasyon sınırına ulaştın. Birini iptal edince yenisini alabilirsin.'],
  bulunamadi: [404, 'Bulunamadı. Kodu kontrol edip yeniden dene.'],
  dolu: [409, 'Bu saat az önce alındı. Başka bir saat seç.'],
  kacirildi: [409, 'Bu maça az önce başka bir takım katıldı ya da ilan kaldırıldı.'],
  basladi: [409, 'Maç başladığı için değişiklik yapılamıyor.'],
  iptal_edilmis: [409, 'Bu rezervasyon iptal edilmiş.'],
  rakip_var: [409, 'Rakip katıldıktan sonra ilan değiştirilemez.'],
  buyuk: [413, 'İstek çok büyük.'],
  hiz: [429, 'Çok hızlı gidiyorsun. Bir dakika sonra yeniden dene.'],
  giris_hiz: [429, 'Çok fazla yanlış deneme. 15 dakika sonra yeniden dene.'],
  sunucu: [500, 'Bir şeyler ters gitti. Biraz sonra yeniden dene.'],
}

function hataYaniti(hata: string, mesaj?: string) {
  const [durum, varsayilan] = MESAJLAR[hata] ?? MESAJLAR.sunucu
  const y = NextResponse.json({ ok: false, hata, mesaj: mesaj ?? varsayilan }, { status: durum })
  y.headers.set('Cache-Control', 'no-store')
  if (durum === 429) y.headers.set('Retry-After', hata === 'giris_hiz' ? '900' : '60')
  return y
}

type Baglam = { govde: Record<string, unknown>; url: URL; ip: string; simdi: Date }
type UcSonucu = NextResponse | ({ ok: true } & object) | { ok: false; hata: string; mesaj?: string }
type Uc = { limit?: 'yazma' | 'kod'; panel?: boolean; isle: (b: Baglam) => Promise<UcSonucu> | UcSonucu }

const kod = (g: Record<string, unknown>) => (typeof g.kod === 'string' ? g.kod.slice(0, 32) : '')

const UCLAR: Record<string, Uc> = {
  'GET saglik': {
    isle: async () => {
      await havuz().query('SELECT 1')
      return { ok: true }
    },
  },

  // ---- Takım ----
  'GET uygunluk': {
    isle: async ({ url, simdi }) => {
      const c = cekirdek()
      const s = await c.uygunluk(url.searchParams.get('tarih') ?? istanbul(simdi).tarih, simdi)
      return s.ok ? { ...s, gunler: c.gunler(simdi) } : s
    },
  },
  'GET rakip-arayanlar': {
    isle: async ({ simdi }) => ({ ok: true, maclar: await cekirdek().rakipArayanlar(simdi) }),
  },
  'POST rezervasyon': {
    limit: 'yazma',
    isle: async ({ govde, ip, simdi }) => {
      const ad = takimAdiDogrula(govde.takimAdi)
      if (!ad.ok) return { ok: false, hata: 'ad', mesaj: ad.mesaj }
      return cekirdek().rezervasyonOlustur(
        { saha: govde.saha, tarih: govde.tarih, saat: govde.saat, takimAdi: ad.ad, rakipAriyor: govde.rakipAriyor === true, ipOzeti: ip },
        simdi,
      )
    },
  },
  'POST rakip-katil': {
    limit: 'yazma',
    isle: async ({ govde, ip, simdi }) => {
      const ad = takimAdiDogrula(govde.takimAdi)
      if (!ad.ok) return { ok: false, hata: 'ad', mesaj: ad.mesaj }
      return cekirdek().rakipKatil({ id: govde.id, takimAdi: ad.ad, ipOzeti: ip }, simdi)
    },
  },
  // Kod URL'de değil gövdede taşınır; böylece sunucu ve vekil günlüklerine düşmez.
  'POST kod': { limit: 'kod', isle: ({ govde, simdi }) => cekirdek().kodlaGetir(kod(govde), simdi) },
  'POST kod/iptal': { limit: 'yazma', isle: ({ govde, simdi }) => cekirdek().iptalEt(kod(govde), simdi) },
  'POST kod/rakip-arama': {
    limit: 'yazma',
    isle: ({ govde, simdi }) => cekirdek().rakipAramaAyarla(kod(govde), govde.acik === true, simdi),
  },
  'POST kod/ayril': { limit: 'yazma', isle: ({ govde, simdi }) => cekirdek().rakipAyril(kod(govde), simdi) },

  // ---- İşletmeci ----
  'POST panel/giris': {
    isle: ({ govde, ip }) => {
      // Sayım, denetim ve kayıt arasında bekleme yok; eşzamanlı denemeler sınırı aşamaz.
      const anahtar = `giris:${ip}`
      if (hizSayisi(anahtar, 15 * DAKIKA) >= 5) return { ok: false, hata: 'giris_hiz' }
      if (typeof govde.sifre !== 'string' || !sifreDogru(govde.sifre)) {
        hizEkle(anahtar)
        return { ok: false, hata: 'sifre' }
      }
      const y = NextResponse.json({ ok: true })
      y.cookies.set(CEREZ, oturumOlustur(), { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: OTURUM_SANIYE })
      return y
    },
  },
  'POST panel/cikis': {
    isle: () => {
      const y = NextResponse.json({ ok: true })
      y.cookies.set(CEREZ, '', { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 0 })
      return y
    },
  },
  'GET panel/gun': {
    panel: true,
    isle: ({ url, simdi }) => cekirdek().gunDokumu(url.searchParams.get('tarih') ?? istanbul(simdi).tarih, simdi),
  },
  'POST panel/iptal': { panel: true, isle: ({ govde }) => cekirdek().isletmeciIptal(govde.id) },
  'POST panel/kapat': { panel: true, isle: ({ govde: g, simdi }) => cekirdek().saatKapat({ saha: g.saha, tarih: g.tarih, saatler: g.saatler, not: g.not }, simdi) },
  'POST panel/ac': { panel: true, isle: ({ govde }) => cekirdek().saatAc(govde.id) },
}

// Tarayıcılar POST isteklerinde Origin gönderir; başka siteden gelen istek reddedilir.
// Origin'siz istek tarayıcı dışı bir istemcidir ve çerez taşımaz, CSRF riski yoktur.
function kaynakUygun(istek: NextRequest): boolean {
  if (istek.headers.get('sec-fetch-site') === 'cross-site') return false
  const kaynak = istek.headers.get('origin')
  if (!kaynak) return true
  try {
    const h = new URL(kaynak).host
    return h === istek.headers.get('host') || h === istek.headers.get('x-forwarded-host')?.split(',')[0].trim()
  } catch {
    return false
  }
}

async function govdeOku(istek: NextRequest): Promise<Record<string, unknown> | 'buyuk' | 'bozuk'> {
  if (Number(istek.headers.get('content-length') ?? 0) > GOVDE_SINIRI) return 'buyuk'
  const okuyucu = istek.body?.getReader()
  const cozucu = new TextDecoder()
  let metin = ''
  let toplam = 0
  // Content-Length'e güvenmeden akışı sayarak okur; sınır aşılınca okumayı keser.
  while (okuyucu) {
    const { done, value } = await okuyucu.read()
    if (done) break
    toplam += value.byteLength
    if (toplam > GOVDE_SINIRI) {
      await okuyucu.cancel()
      return 'buyuk'
    }
    metin += cozucu.decode(value, { stream: true })
  }
  try {
    const v: unknown = JSON.parse(metin || '{}')
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : 'bozuk'
  } catch {
    return 'bozuk'
  }
}

async function yonlendir(istek: NextRequest, yol: string[]) {
  const uc = UCLAR[`${istek.method} ${yol.join('/')}`]
  if (!uc) return hataYaniti('bulunamadi', 'Böyle bir uç yok.')
  try {
    const a = ayarlar()
    if (istek.method !== 'GET' && !kaynakUygun(istek)) return hataYaniti('kaynak')
    if (uc.panel && !oturumGecerli(istek.cookies.get(CEREZ)?.value)) return hataYaniti('oturum')
    const ip = ipOzeti(istemciIp(istek.headers.get('x-forwarded-for'), a.vekilSayisi), a.ipOzetAnahtari)
    if (uc.limit && hizAsildi(`${uc.limit}:${ip}`, 10, DAKIKA)) return hataYaniti('hiz')
    let govde: Record<string, unknown> = {}
    if (istek.method === 'POST') {
      const g = await govdeOku(istek)
      if (typeof g === 'string') return hataYaniti(g)
      govde = g
    }
    const s = await uc.isle({ govde, url: istek.nextUrl, ip, simdi: new Date() })
    if (s instanceof NextResponse) return s
    if (!s.ok) return hataYaniti(s.hata, s.mesaj)
    const y = NextResponse.json(s)
    y.headers.set('Cache-Control', 'no-store')
    return y
  } catch (e) {
    console.error(`${istek.method} /api/${yol.join('/')} başarısız:`, e)
    return hataYaniti('sunucu')
  }
}

type Parametreler = { params: Promise<{ yol: string[] }> }
export const GET = async (istek: NextRequest, { params }: Parametreler) => yonlendir(istek, (await params).yol)
export const POST = GET
