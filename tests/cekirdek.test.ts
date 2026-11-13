// Rezervasyon çekirdeği testleri. Gerçek PostgreSQL'e karşı çalışır, çünkü çift rezervasyon
// garantisi veritabanı kısıtındadır. Önce: docker compose -f docker-compose.test.yml up -d --wait
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cekirdekOlustur } from '../src/lib/cekirdek'
import { gocleriUygula } from '../src/lib/gocler'

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL ?? 'postgres://test:test@127.0.0.1:54329/test',
  max: 20,
})
const c = cekirdekOlustur(pool, { acilis: 9, kapanis: 24, gunSayisi: 7, ipSiniri: 3, ozetAnahtari: 'test-anahtari' })

// Cuma 13 Kasım 2026, İstanbul saatiyle 10:30. Bugünün 09:00 ve 10:00 dilimleri başlamış durumda.
const SIMDI = new Date('2026-11-13T10:30:00+03:00')
const BUGUN = '2026-11-13'
const YARIN = '2026-11-14'

let ipNo = 0
const yeniIp = () => `ip-${++ipNo}`
const al = (ek: Record<string, unknown> = {}, simdi = SIMDI) =>
  c.rezervasyonOlustur(
    { saha: 'acik', tarih: YARIN, saat: 20, takimAdi: 'Kartallar', rakipAriyor: false, ipOzeti: yeniIp(), ...ek },
    simdi,
  )
/** Başarılı olması beklenen rezervasyonun kodunu döndürür. */
async function kodAl(ek: Record<string, unknown> = {}) {
  const r = await al(ek)
  if (!r.ok) throw new Error('rezervasyon alınamadı: ' + r.hata)
  return r.kod
}
async function dilim(saha: 'acik' | 'kapali', tarih: string, saat: number, simdi = SIMDI) {
  const u = await c.uygunluk(tarih, simdi)
  if (!u.ok) throw new Error(u.hata)
  return u.sahalar[saha].find((d) => d.saat === saat)!
}
const say = <T extends { ok: boolean }>(liste: T[]) => liste.filter((x) => x.ok).length

beforeAll(() => gocleriUygula(pool))
beforeEach(() => pool.query('TRUNCATE kayitlar RESTART IDENTITY'))
afterAll(() => pool.end())

describe('uygunluk', () => {
  it('boş bir günde iki saha için 09:00-23:00 arası 15 boş dilim döner', async () => {
    const u = await c.uygunluk(YARIN, SIMDI)
    expect(u.ok).toBe(true)
    if (!u.ok) return
    for (const saha of ['acik', 'kapali'] as const) {
      expect(u.sahalar[saha].map((d) => d.saat)).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23])
      expect(u.sahalar[saha].every((d) => d.durum === 'bos')).toBe(true)
    }
  })

  it('bugünün başlamış dilimleri geçmiş, sonrakiler boş görünür', async () => {
    expect((await dilim('acik', BUGUN, 9)).durum).toBe('gecmis')
    expect((await dilim('acik', BUGUN, 10)).durum).toBe('gecmis')
    expect((await dilim('acik', BUGUN, 11)).durum).toBe('bos')
  })

  it('dolu saatte takım adı vermez, rakip arayanda verir, bakımı ayrı gösterir', async () => {
    await kodAl({ saat: 18, takimAdi: 'Gizli FC' })
    await kodAl({ saat: 19, takimAdi: 'Rakip Bekleyenler', rakipAriyor: true })
    await c.saatKapat({ saha: 'acik', tarih: YARIN, saatler: [21] }, SIMDI)

    expect(await dilim('acik', YARIN, 18)).toEqual({ saat: 18, durum: 'dolu' })
    expect(await dilim('acik', YARIN, 19)).toMatchObject({ durum: 'rakip_ariyor', takimAdi: 'Rakip Bekleyenler' })
    expect(await dilim('acik', YARIN, 21)).toEqual({ saat: 21, durum: 'bakim' })
    expect((await dilim('kapali', YARIN, 18)).durum).toBe('bos')
  })

  it('pencere dışındaki ve bozuk tarihleri reddeder', async () => {
    expect(await c.uygunluk('2026-11-19', SIMDI)).toMatchObject({ ok: true }) // 7. gün
    expect(await c.uygunluk('2026-11-20', SIMDI)).toEqual({ ok: false, hata: 'pencere_disi' })
    expect(await c.uygunluk('2026-11-12', SIMDI)).toEqual({ ok: false, hata: 'pencere_disi' })
    expect(await c.uygunluk('2026-02-30', SIMDI)).toEqual({ ok: false, hata: 'gecersiz' })
    expect(await c.uygunluk("'; DROP TABLE kayitlar; --", SIMDI)).toEqual({ ok: false, hata: 'gecersiz' })
  })

  it('rezervasyona açık günleri bugünden başlayarak listeler', () => {
    expect(c.gunler(SIMDI)).toEqual([
      '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19',
    ])
  })
})

describe('rezervasyon', () => {
  it('kod döndürür ve kodla doğru bilgi gelir', async () => {
    const kod = await kodAl({ saha: 'kapali', saat: 21, takimAdi: 'Yıldızlar' })
    expect(kod).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/)
    expect(await c.kodlaGetir(kod, SIMDI)).toEqual({
      ok: true,
      rol: 'ev_sahibi',
      saha: 'kapali',
      tarih: YARIN,
      saat: 21,
      durum: 'aktif',
      iptalEden: null,
      takimAdi: 'Yıldızlar',
      rakipTakimAdi: null,
      rakipAriyor: false,
      basladi: false,
    })
  })

  it('kod küçük harfle ya da boşluklu yazılsa da bulunur, yanlış kod bulunamaz', async () => {
    const kod = await kodAl()
    expect(await c.kodlaGetir(` ${kod.slice(0, 4).toLowerCase()} ${kod.slice(4)} `, SIMDI)).toMatchObject({ ok: true })
    expect(await c.kodlaGetir('YANLIS22', SIMDI)).toEqual({ ok: false, hata: 'bulunamadi' })
    expect(await c.kodlaGetir('', SIMDI)).toEqual({ ok: false, hata: 'bulunamadi' })
  })

  it('dolu dilime ikinci rezervasyon alınamaz', async () => {
    await kodAl()
    expect(await al()).toEqual({ ok: false, hata: 'dolu' })
    expect(await al({ saha: 'kapali' })).toMatchObject({ ok: true }) // diğer saha bağımsız
  })

  it('aynı dilime 50 eşzamanlı istekten tam biri başarılı olur', async () => {
    const sonuclar = await Promise.all(Array.from({ length: 50 }, (_, i) => al({ takimAdi: `Takım ${i}` })))
    expect(say(sonuclar)).toBe(1)
    expect(sonuclar.filter((s) => !s.ok && s.hata === 'dolu')).toHaveLength(49)
    expect((await dilim('acik', YARIN, 20)).durum).toBe('dolu')
    const d = await c.gunDokumu(YARIN, SIMDI)
    expect(d.ok && d.sahalar.acik.filter((x) => x.durum === 'dolu')).toHaveLength(1)
  })

  it('geçmiş, pencere dışı ve geçersiz dilimler alınamaz', async () => {
    expect(await al({ tarih: BUGUN, saat: 10 })).toEqual({ ok: false, hata: 'gecmis_saat' })
    expect(await al({ tarih: '2026-11-12' })).toEqual({ ok: false, hata: 'gecmis_saat' })
    expect(await al({ tarih: '2026-11-20' })).toEqual({ ok: false, hata: 'pencere_disi' })
    expect(await al({ tarih: BUGUN, saat: 11 })).toMatchObject({ ok: true })
    for (const ek of [{ saat: 8 }, { saat: 24 }, { saat: 9.5 }, { saat: '20' }, { saha: 'orta' }, { tarih: 'yarın' }]) {
      expect(await al(ek)).toEqual({ ok: false, hata: 'gecersiz' })
    }
  })

  it('aynı IP en fazla 3 aktif rezervasyon alır; iptal edince yenisini alabilir', async () => {
    const ip = yeniIp()
    const kod = await kodAl({ saat: 17, ipOzeti: ip })
    await kodAl({ saat: 18, ipOzeti: ip })
    await kodAl({ saat: 19, ipOzeti: ip })
    expect(await al({ saat: 20, ipOzeti: ip })).toEqual({ ok: false, hata: 'sinir' })
    expect(await al({ saat: 20 })).toMatchObject({ ok: true }) // başka IP etkilenmez

    await c.iptalEt(kod, SIMDI)
    expect(await al({ saat: 21, ipOzeti: ip })).toMatchObject({ ok: true })
  })

  it('IP sınırı eşzamanlı isteklerde de aşılmaz', async () => {
    const ip = yeniIp()
    const saatler = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    const sonuclar = await Promise.all(saatler.map((saat) => al({ saat, ipOzeti: ip })))
    expect(say(sonuclar)).toBe(3)
    expect(sonuclar.filter((s) => !s.ok && s.hata === 'sinir')).toHaveLength(9)
  })

  it('maçı oynanmış rezervasyon sınıra sayılmaz', async () => {
    const ip = yeniIp()
    for (const saat of [11, 12, 13]) await kodAl({ tarih: BUGUN, saat, ipOzeti: ip })
    const aksam = new Date('2026-11-13T14:00:00+03:00')
    expect(await al({ saat: 20, ipOzeti: ip }, aksam)).toMatchObject({ ok: true })
  })
})

describe('iptal', () => {
  it('iptal saati boşaltır, kod iptali gösterir, saat yeniden alınabilir', async () => {
    const kod = await kodAl()
    expect(await c.iptalEt(kod, SIMDI)).toEqual({ ok: true })
    expect((await dilim('acik', YARIN, 20)).durum).toBe('bos')
    expect(await c.kodlaGetir(kod, SIMDI)).toMatchObject({ durum: 'iptal', iptalEden: 'takim' })
    expect(await c.iptalEt(kod, SIMDI)).toEqual({ ok: false, hata: 'iptal_edilmis' })
    expect(await al()).toMatchObject({ ok: true })
  })

  it('başlamış maç iptal edilemez', async () => {
    const kod = await kodAl({ tarih: BUGUN, saat: 11 })
    const baslamadan = new Date('2026-11-13T10:59:00+03:00')
    const basladiktan = new Date('2026-11-13T11:00:00+03:00')
    expect(await c.kodlaGetir(kod, baslamadan)).toMatchObject({ basladi: false })
    expect(await c.kodlaGetir(kod, basladiktan)).toMatchObject({ basladi: true })
    expect(await c.iptalEt(kod, basladiktan)).toEqual({ ok: false, hata: 'basladi' })
    expect(await c.iptalEt(kod, baslamadan)).toEqual({ ok: true })
  })

  it('yanlış kodla iptal bulunamadı döner', async () => {
    await kodAl()
    expect(await c.iptalEt('YANLIS22', SIMDI)).toEqual({ ok: false, hata: 'bulunamadi' })
    expect((await dilim('acik', YARIN, 20)).durum).toBe('dolu')
  })
})

describe('rakip bulma', () => {
  const ilanlar = async (simdi = SIMDI) => (await c.rakipArayanlar(simdi)).map((m) => m.takimAdi)
  async function ilanAc(ek: Record<string, unknown> = {}) {
    const kod = await kodAl({ takimAdi: 'Ev Sahibi', rakipAriyor: true, ...ek })
    const [ilan] = await c.rakipArayanlar(SIMDI)
    return { kod, id: ilan.id }
  }
  const katil = (id: number, ek: Record<string, unknown> = {}) =>
    c.rakipKatil({ id, takimAdi: 'Deplasman', ipOzeti: yeniIp(), ...ek }, SIMDI)

  it('ilan listede görünür; işaret kodla kapatılıp açılır', async () => {
    const { kod } = await ilanAc()
    expect(await c.rakipArayanlar(SIMDI)).toEqual([
      { id: expect.any(Number), saha: 'acik', tarih: YARIN, saat: 20, takimAdi: 'Ev Sahibi' },
    ])
    expect(await c.rakipAramaAyarla(kod, false, SIMDI)).toEqual({ ok: true })
    expect(await ilanlar()).toEqual([])
    expect(await c.rakipAramaAyarla(kod, true, SIMDI)).toEqual({ ok: true })
    expect(await ilanlar()).toEqual(['Ev Sahibi'])
  })

  it('rakip katılınca kendi kodunu alır, iki taraf birbirini görür, ilan listeden düşer', async () => {
    const { kod, id } = await ilanAc()
    const r = await katil(id)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.kod).not.toBe(kod)
    expect(await c.kodlaGetir(kod, SIMDI)).toMatchObject({ rol: 'ev_sahibi', rakipTakimAdi: 'Deplasman' })
    expect(await c.kodlaGetir(r.kod, SIMDI)).toMatchObject({ rol: 'rakip', takimAdi: 'Ev Sahibi', rakipTakimAdi: 'Deplasman' })
    expect(await ilanlar()).toEqual([])
    expect((await dilim('acik', YARIN, 20)).durum).toBe('dolu')
  })

  it('aynı maça 20 eşzamanlı katılımdan tam biri kazanır', async () => {
    const { kod, id } = await ilanAc()
    const sonuclar = await Promise.all(Array.from({ length: 20 }, (_, i) => katil(id, { takimAdi: `Rakip ${i}` })))
    expect(say(sonuclar)).toBe(1)
    expect(sonuclar.filter((s) => !s.ok && s.hata === 'kacirildi')).toHaveLength(19)
    const kazanan = sonuclar.findIndex((s) => s.ok)
    expect(await c.kodlaGetir(kod, SIMDI)).toMatchObject({ rakipTakimAdi: `Rakip ${kazanan}` })
  })

  it('rakip ayrılınca ilan geri döner ve rakibin kodu geçersizleşir', async () => {
    const { kod, id } = await ilanAc()
    const r = await katil(id)
    if (!r.ok) throw new Error(r.hata)
    expect(await c.rakipAyril(r.kod, SIMDI)).toEqual({ ok: true })
    expect(await ilanlar()).toEqual(['Ev Sahibi'])
    expect(await c.kodlaGetir(kod, SIMDI)).toMatchObject({ rakipTakimAdi: null, rakipAriyor: true })
    expect(await c.kodlaGetir(r.kod, SIMDI)).toEqual({ ok: false, hata: 'bulunamadi' })
    expect(await katil(id)).toMatchObject({ ok: true }) // yeni rakip katılabilir
  })

  it('ev sahibi iptal edince saat boşalır ve rakibin kodu iptali gösterir', async () => {
    const { kod, id } = await ilanAc()
    const r = await katil(id)
    if (!r.ok) throw new Error(r.hata)
    await c.iptalEt(kod, SIMDI)
    expect(await c.kodlaGetir(r.kod, SIMDI)).toMatchObject({ rol: 'rakip', durum: 'iptal', iptalEden: 'takim' })
    expect((await dilim('acik', YARIN, 20)).durum).toBe('bos')
    expect(await c.rakipAyril(r.kod, SIMDI)).toEqual({ ok: false, hata: 'iptal_edilmis' })
  })

  it('rakip varken ilan işareti değiştirilemez', async () => {
    const { kod, id } = await ilanAc()
    await katil(id)
    expect(await c.rakipAramaAyarla(kod, false, SIMDI)).toEqual({ ok: false, hata: 'rakip_var' })
  })

  it('rakip aramayan, iptal edilmiş ya da olmayan maça katılınamaz', async () => {
    await kodAl({ saat: 18 })
    const d = await c.gunDokumu(YARIN, SIMDI)
    const kapaliIlanId = d.ok ? d.sahalar.acik.find((x) => x.saat === 18)!.id! : 0
    expect(await katil(kapaliIlanId)).toEqual({ ok: false, hata: 'kacirildi' })

    const { kod, id } = await ilanAc()
    await c.iptalEt(kod, SIMDI)
    expect(await katil(id)).toEqual({ ok: false, hata: 'kacirildi' })
    expect(await katil(999999)).toEqual({ ok: false, hata: 'kacirildi' })
    expect(await katil('1; DROP TABLE kayitlar' as unknown as number)).toEqual({ ok: false, hata: 'gecersiz' })
  })

  it('başlamış maçın ilanı listeden düşer ve maça katılınamaz', async () => {
    const { id } = await ilanAc({ tarih: BUGUN, saat: 11 })
    const sonra = new Date('2026-11-13T11:05:00+03:00')
    expect(await ilanlar(sonra)).toEqual([])
    expect(await c.rakipKatil({ id, takimAdi: 'Geç Kalan', ipOzeti: yeniIp() }, sonra)).toEqual({ ok: false, hata: 'kacirildi' })
  })

  it('kodlar rol dışı işlemde kullanılamaz', async () => {
    const { kod, id } = await ilanAc()
    const r = await katil(id)
    if (!r.ok) throw new Error(r.hata)
    expect(await c.iptalEt(r.kod, SIMDI)).toEqual({ ok: false, hata: 'yetkisiz' })
    expect(await c.rakipAramaAyarla(r.kod, false, SIMDI)).toEqual({ ok: false, hata: 'yetkisiz' })
    expect(await c.rakipAyril(kod, SIMDI)).toEqual({ ok: false, hata: 'yetkisiz' })
    expect(await c.kodlaGetir(kod, SIMDI)).toMatchObject({ durum: 'aktif', rakipTakimAdi: 'Deplasman' })
  })

  it('rakip katılımı da IP sınırına sayılır', async () => {
    const ip = yeniIp()
    await kodAl({ saat: 17, ipOzeti: ip })
    await kodAl({ saat: 18, ipOzeti: ip })
    const { id } = await ilanAc({ saat: 19 })
    expect(await katil(id, { ipOzeti: ip })).toMatchObject({ ok: true }) // 3. kayıt
    await kodAl({ saat: 21, takimAdi: 'Başka İlan', rakipAriyor: true })
    const ikinci = (await c.rakipArayanlar(SIMDI)).find((m) => m.takimAdi === 'Başka İlan')!
    expect(await katil(ikinci.id, { ipOzeti: ip })).toEqual({ ok: false, hata: 'sinir' })
    expect(await al({ saat: 22, ipOzeti: ip })).toEqual({ ok: false, hata: 'sinir' })
  })
})

describe('işletmeci', () => {
  it('kapatılan saat alınamaz; açılınca yeniden alınır', async () => {
    const k = await c.saatKapat({ saha: 'acik', tarih: YARIN, saatler: [20, 21], not: '  Zemin bakımı  ' }, SIMDI)
    expect(k).toEqual({ ok: true, kapatilan: [20, 21], dolu: [] })
    expect(await al({ saat: 20 })).toEqual({ ok: false, hata: 'dolu' })

    const d = await c.gunDokumu(YARIN, SIMDI)
    if (!d.ok) throw new Error(d.hata)
    const bakim = d.sahalar.acik.find((x) => x.saat === 20)!
    expect(bakim).toMatchObject({ durum: 'bakim', not: 'Zemin bakımı' })

    expect(await c.saatAc(bakim.id)).toEqual({ ok: true })
    expect(await al({ saat: 20 })).toMatchObject({ ok: true })
    expect(await al({ saat: 21 })).toEqual({ ok: false, hata: 'dolu' }) // diğeri hâlâ kapalı
  })

  it('dolu saat kapatılamaz, rezervasyon yerinde kalır', async () => {
    const kod = await kodAl({ saat: 20 })
    expect(await c.saatKapat({ saha: 'acik', tarih: YARIN, saatler: [20, 21] }, SIMDI)).toEqual({
      ok: true,
      kapatilan: [21],
      dolu: [20],
    })
    expect(await c.kodlaGetir(kod, SIMDI)).toMatchObject({ durum: 'aktif' })
  })

  it('geçmiş ya da geçersiz saat kapatılamaz', async () => {
    expect(await c.saatKapat({ saha: 'acik', tarih: BUGUN, saatler: [10] }, SIMDI)).toEqual({ ok: false, hata: 'gecmis_saat' })
    expect(await c.saatKapat({ saha: 'acik', tarih: YARIN, saatler: [] }, SIMDI)).toEqual({ ok: false, hata: 'gecersiz' })
    expect(await c.saatKapat({ saha: 'acik', tarih: YARIN, saatler: [25] }, SIMDI)).toEqual({ ok: false, hata: 'gecersiz' })
  })

  it('işletmeci iptali saati boşaltır ve iki takımın kodunda da görünür', async () => {
    const kod = await kodAl({ rakipAriyor: true })
    const [ilan] = await c.rakipArayanlar(SIMDI)
    const r = await c.rakipKatil({ id: ilan.id, takimAdi: 'Deplasman', ipOzeti: yeniIp() }, SIMDI)
    if (!r.ok) throw new Error(r.hata)

    expect(await c.isletmeciIptal(ilan.id)).toEqual({ ok: true })
    expect(await c.kodlaGetir(kod, SIMDI)).toMatchObject({ durum: 'iptal', iptalEden: 'isletmeci' })
    expect(await c.kodlaGetir(r.kod, SIMDI)).toMatchObject({ durum: 'iptal', iptalEden: 'isletmeci' })
    expect((await dilim('acik', YARIN, 20)).durum).toBe('bos')
    expect(await c.isletmeciIptal(ilan.id)).toEqual({ ok: false, hata: 'bulunamadi' })
  })

  it('işletmeci iptali bakım kaydını, saat açma rezervasyonu etkilemez', async () => {
    await kodAl({ saat: 20 })
    await c.saatKapat({ saha: 'acik', tarih: YARIN, saatler: [21] }, SIMDI)
    const d = await c.gunDokumu(YARIN, SIMDI)
    if (!d.ok) throw new Error(d.hata)
    const rezervasyon = d.sahalar.acik.find((x) => x.saat === 20)!
    const bakim = d.sahalar.acik.find((x) => x.saat === 21)!
    expect(await c.isletmeciIptal(bakim.id)).toEqual({ ok: false, hata: 'bulunamadi' })
    expect(await c.saatAc(rezervasyon.id)).toEqual({ ok: false, hata: 'bulunamadi' })
  })

  it('gün dökümü takım, rakip ve geçmiş bilgisini verir', async () => {
    await kodAl({ tarih: BUGUN, saat: 11, takimAdi: 'Sabahçılar', rakipAriyor: true })
    const d = await c.gunDokumu(BUGUN, SIMDI)
    if (!d.ok) throw new Error(d.hata)
    expect(d.sahalar.acik.find((x) => x.saat === 10)).toEqual({ saat: 10, gecmis: true, durum: 'bos' })
    expect(d.sahalar.acik.find((x) => x.saat === 11)).toMatchObject({
      gecmis: false,
      durum: 'dolu',
      takimAdi: 'Sabahçılar',
      rakipTakimAdi: null,
      rakipAriyor: true,
    })
    expect(d.sahalar.kapali).toHaveLength(15)
  })
})

describe('eski kayıt temizliği', () => {
  it('maç tarihinden 7 gün sonra kaydı siler, öncesinde dokunmaz', async () => {
    const kod = await kodAl({ tarih: YARIN }) // maç 14 Kasım
    expect(await c.eskiKayitlariSil(new Date('2026-11-21T12:00:00+03:00'))).toBe(0)
    expect(await c.kodlaGetir(kod, SIMDI)).toMatchObject({ ok: true })
    expect(await c.eskiKayitlariSil(new Date('2026-11-22T12:00:00+03:00'))).toBe(1)
    expect(await c.kodlaGetir(kod, SIMDI)).toEqual({ ok: false, hata: 'bulunamadi' })
  })
})
