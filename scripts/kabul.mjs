// Kabul kriterlerini çalışan uygulamaya karşı HTTP üzerinden doğrular (prd.md, kriter 3-11).
//
// Çalıştırma: uygulama GUVENILIR_VEKIL_SAYISI=1 ile ayakta olmalı. Betik, bir ters vekilin yapacağı
// gibi her "izleyici" için ayrı X-Forwarded-For adresi gönderir; böylece IP sınırları tek makineden
// sınanabilir. (Vekilsiz kurulumda bu başlığın işe yaramadığı ayrıca TESLIM_RAPORU.md'de gösterilir.)
//
//   GUVENILIR_VEKIL_SAYISI=1 docker compose up -d
//   node --env-file=.env scripts/kabul.mjs
import { execFileSync } from 'node:child_process'

const TABAN = process.env.TABAN ?? 'http://localhost:3000'
const SIFRE = process.env.PANEL_SIFRESI
if (!SIFRE) throw new Error('PANEL_SIFRESI gerekli: node --env-file=.env scripts/kabul.mjs')

let ipNo = 0
const yeniIp = () => `10.${(Date.now() >> 8) & 255}.${(++ipNo >> 8) & 255}.${ipNo & 255}`

/** Belirli bir IP'den gelen "izleyici". */
function istemci(ip = yeniIp(), cerez = '') {
  const iste = async (yol, govde, ek = {}) => {
    const y = await fetch(`${TABAN}/api/${yol}`, {
      method: govde === undefined ? 'GET' : 'POST',
      headers: { 'X-Forwarded-For': ip, 'Content-Type': 'application/json', ...(cerez && { Cookie: cerez }), ...ek },
      body: govde === undefined ? undefined : typeof govde === 'string' ? govde : JSON.stringify(govde),
    })
    let veri = null
    try {
      veri = await y.json()
    } catch {}
    return { durum: y.status, veri, basliklar: y.headers }
  }
  return { ip, iste }
}

const sql = (sorgu) =>
  execFileSync('docker', ['compose', 'exec', '-T', 'db', 'psql', '-U', 'halisaha', '-d', 'halisaha', '-Atc', sorgu], {
    encoding: 'utf8',
  }).trim()

let hatalar = 0
function kontrol(kriter, ad, kosul, kanit = '') {
  if (!kosul) hatalar++
  console.log(`${kosul ? 'GEÇTİ ' : 'KALDI '} [K${kriter}] ${ad}${kanit ? `  →  ${kanit}` : ''}`)
}

// Sınamalar birbirinin saatine basmasın diye her çağrıda başka bir boş dilim verir (son günden geriye).
const { veri: ilk } = await istemci().iste('uygunluk')
const gunler = [...ilk.gunler].reverse()
const kullanilan = new Set()
async function bosDilim() {
  for (const tarih of gunler)
    for (const saha of ['acik', 'kapali']) {
      const { veri } = await istemci().iste(`uygunluk?tarih=${tarih}`)
      const d = veri.sahalar[saha].find((x) => x.durum === 'bos' && !kullanilan.has(`${tarih}${saha}${x.saat}`))
      if (d) {
        kullanilan.add(`${tarih}${saha}${d.saat}`)
        return { saha, tarih, saat: d.saat }
      }
    }
  throw new Error('Boş dilim kalmadı; veritabanını sıfırlayıp yeniden deneyin.')
}
const durumu = async ({ saha, tarih, saat }) =>
  (await istemci().iste(`uygunluk?tarih=${tarih}`)).veri.sahalar[saha].find((x) => x.saat === saat)

// ---------- K3: uçtan uca akış ----------
{
  const c = istemci()
  const d = await bosDilim()
  const r = await c.iste('rezervasyon', { ...d, takimAdi: 'Kabul Testi FC', rakipAriyor: false })
  kontrol(3, 'boş saat seçilip takım adıyla rezervasyon alınır, kod döner', r.durum === 200 && /^[A-Z2-9]{8}$/.test(r.veri.kod), `HTTP ${r.durum}, kod ${r.veri.kod?.length} karakter`)
  kontrol(3, 'saat artık dolu görünür ve takım adı herkese açık listede yoktur', (await durumu(d)).durum === 'dolu' && !(await durumu(d)).takimAdi, JSON.stringify(await durumu(d)))
  const g = await c.iste('kod', { kod: r.veri.kod })
  kontrol(3, 'kodla rezervasyon görüntülenir', g.veri.ok && g.veri.takimAdi === 'Kabul Testi FC' && g.veri.saat === d.saat && g.veri.durum === 'aktif', `${g.veri.tarih} ${g.veri.saat}:00 ${g.veri.saha} ${g.veri.durum}`)
  const y = await c.iste('kod', { kod: 'YANLIS22' })
  kontrol(3, 'yanlış kod yalnız "bulunamadı" döner', y.durum === 404 && y.veri.hata === 'bulunamadi', `HTTP ${y.durum} ${y.veri.hata}`)
  const i = await c.iste('kod/iptal', { kod: r.veri.kod })
  kontrol(3, 'kodla iptal edilir, saat yeniden boş görünür', i.durum === 200 && (await durumu(d)).durum === 'bos', `HTTP ${i.durum}, dilim: ${(await durumu(d)).durum}`)
  const s = await c.iste('kod', { kod: r.veri.kod })
  kontrol(3, 'iptal sonrası kod iptali gösterir', s.veri.durum === 'iptal' && s.veri.iptalEden === 'takim', `${s.veri.durum} / ${s.veri.iptalEden}`)
}

// ---------- K4: 50 eşzamanlı istek, tek kazanan ----------
{
  const d = await bosDilim()
  const sonuclar = await Promise.all(
    Array.from({ length: 50 }, (_, n) => istemci().iste('rezervasyon', { ...d, takimAdi: `Yarisan ${n}`, rakipAriyor: false })),
  )
  const basarili = sonuclar.filter((s) => s.durum === 200).length
  const dolu = sonuclar.filter((s) => s.durum === 409 && s.veri.hata === 'dolu').length
  kontrol(4, 'aynı dilime 50 eşzamanlı istekten tam 1 tanesi başarılı', basarili === 1 && dolu === 49, `${basarili} başarılı, ${dolu} "dolu" (409)`)
  const n = sql(`SELECT count(*) FROM kayitlar WHERE saha='${d.saha}' AND tarih='${d.tarih}' AND saat=${d.saat} AND durum='aktif'`)
  kontrol(4, 'veritabanında o dilim için tek aktif kayıt var', n === '1', `count = ${n}`)
}

// ---------- K5: rakip akışı ----------
{
  const ev = istemci()
  const d = await bosDilim()
  const r = await ev.iste('rezervasyon', { ...d, takimAdi: 'Ev Sahibi SK', rakipAriyor: true })
  const ilan = async () => (await istemci().iste('rakip-arayanlar')).veri.maclar.find((m) => m.tarih === d.tarih && m.saat === d.saat && m.saha === d.saha)
  const m = await ilan()
  kontrol(5, '"rakip arıyoruz" işaretli maç listede takım adıyla görünür', m?.takimAdi === 'Ev Sahibi SK', JSON.stringify(m))

  const k = await istemci().iste('rakip-katil', { id: m.id, takimAdi: 'Deplasman SK' })
  kontrol(5, 'ikinci takım katılır ve kendi kodunu alır', k.durum === 200 && /^[A-Z2-9]{8}$/.test(k.veri.kod) && k.veri.kod !== r.veri.kod, `HTTP ${k.durum}`)
  kontrol(5, 'maç listeden düşer', (await ilan()) === undefined)
  const evGorur = await ev.iste('kod', { kod: r.veri.kod })
  kontrol(5, 'ev sahibi koduyla rakibinin adını görür', evGorur.veri.rakipTakimAdi === 'Deplasman SK', evGorur.veri.rakipTakimAdi)
  const a = await istemci().iste('kod/ayril', { kod: k.veri.kod })
  kontrol(5, 'rakip ayrılınca maç listeye döner', a.durum === 200 && (await ilan())?.id === m.id, `HTTP ${a.durum}`)

  const yaris = await Promise.all(Array.from({ length: 20 }, (_, n) => istemci().iste('rakip-katil', { id: m.id, takimAdi: `Aday ${n}` })))
  const kazanan = yaris.filter((s) => s.durum === 200).length
  const kaciran = yaris.filter((s) => s.durum === 409 && s.veri.hata === 'kacirildi').length
  kontrol(5, 'aynı maça 20 eşzamanlı katılımdan tam 1 tanesi başarılı', kazanan === 1 && kaciran === 19, `${kazanan} başarılı, ${kaciran} "kaçırıldı" (409)`)

  const rakipKodu = yaris.find((s) => s.durum === 200).veri.kod
  await ev.iste('kod/iptal', { kod: r.veri.kod })
  const rakipGorur = await istemci().iste('kod', { kod: rakipKodu })
  kontrol(5, 'ev sahibi iptal edince rakibin kodu iptali gösterir', rakipGorur.veri.durum === 'iptal' && rakipGorur.veri.iptalEden === 'takim', `${rakipGorur.veri.durum} / ${rakipGorur.veri.iptalEden}`)
}

// ---------- K6: IP başına 3 aktif rezervasyon ----------
{
  const c = istemci()
  const kodlar = []
  for (let n = 0; n < 3; n++) kodlar.push((await c.iste('rezervasyon', { ...(await bosDilim()), takimAdi: `Sinir ${n}`, rakipAriyor: false })).veri.kod)
  const d4 = await bosDilim()
  const r4 = await c.iste('rezervasyon', { ...d4, takimAdi: 'Sinir 4', rakipAriyor: false })
  kontrol(6, 'aynı IP ilk 3 rezervasyonu alır, 4. reddedilir', kodlar.every(Boolean) && r4.durum === 403 && r4.veri.hata === 'sinir', `4. istek: HTTP ${r4.durum} "${r4.veri.mesaj}"`)
  const baska = await istemci().iste('rezervasyon', { ...d4, takimAdi: 'Baska IP', rakipAriyor: false })
  kontrol(6, 'aynı saati başka bir IP alabilir (sınır IP başınadır)', baska.durum === 200, `HTTP ${baska.durum}`)
  await c.iste('kod/iptal', { kod: kodlar[0] })
  const r5 = await c.iste('rezervasyon', { ...(await bosDilim()), takimAdi: 'Sinir 5', rakipAriyor: false })
  kontrol(6, 'biri iptal edilince yenisi alınabilir', r5.durum === 200, `HTTP ${r5.durum}`)
}

// ---------- K7: hız limiti ----------
{
  const c = istemci()
  const d = await bosDilim()
  const durumlar = []
  // Geçersiz saha ile gönderilir: istek sayılır ama saat tüketmez.
  for (let n = 0; n < 12; n++) durumlar.push((await c.iste('rezervasyon', { ...d, saha: 'yok', takimAdi: 'Hizli', rakipAriyor: false })).durum)
  kontrol(7, 'dakikada 10 yazma isteğinden sonrası 429 döner', durumlar.slice(0, 10).every((s) => s === 400) && durumlar[10] === 429 && durumlar[11] === 429, durumlar.join(' '))
  const c2 = istemci()
  const kodDurumlari = []
  let sonYanit
  for (let n = 0; n < 12; n++) kodDurumlari.push((sonYanit = await c2.iste('kod', { kod: 'TAHMIN' + n })).durum)
  kontrol(7, 'dakikada 10 kod sorgusundan sonrası 429 döner (kod tahmini sınırlı)', kodDurumlari.slice(0, 10).every((s) => s === 404) && kodDurumlari[10] === 429, kodDurumlari.join(' '))
  kontrol(7, '429 yanıtı anlaşılır mesaj ve Retry-After taşır', sonYanit.veri.mesaj?.length > 10 && sonYanit.basliklar.get('retry-after') === '60', `"${sonYanit.veri.mesaj}" Retry-After: ${sonYanit.basliklar.get('retry-after')}`)
  const temiz = await istemci().iste('kod', { kod: 'TAHMIN00' })
  kontrol(7, 'sınır IP başınadır: başka IP etkilenmez', temiz.durum === 404, `HTTP ${temiz.durum}`)
}

// ---------- K8: takım adı kuralları ----------
{
  const d = await bosDilim()
  const reddedilenler = {
    küfür: 'Siktir FC',
    'boşluklu küfür': 'o r o s p u lar',
    'rakamla küfür': 'S1kt1r Spor',
    bağlantı: 'www.bahis.com',
    'bağlantı 2': 'bedava.site',
    'tek karakter': 'A',
    '25 karakter': 'A'.repeat(25),
    HTML: '<script>alert(1)</script>',
    'HTML 2': '<img src=x onerror=1>',
    'yalnız boşluk': '    ',
    'sayı (metin değil)': 12345,
  }
  for (const [tur, takimAdi] of Object.entries(reddedilenler)) {
    const r = await istemci().iste('rezervasyon', { ...d, takimAdi, rakipAriyor: true })
    kontrol(8, `reddedilir: ${tur} (${JSON.stringify(takimAdi).slice(0, 30)})`, r.durum === 400 && r.veri.hata === 'ad', `HTTP ${r.durum} "${r.veri.mesaj}"`)
  }
  const k = await istemci().iste('rakip-katil', { id: 1, takimAdi: '<b>kalın</b>' })
  kontrol(8, 'rakip katılımında da ad doğrulanır', k.durum === 400 && k.veri.hata === 'ad', `HTTP ${k.durum}`)
  kontrol(8, 'reddedilen adlarla saat alınmamıştır', (await durumu(d)).durum === 'bos')
  for (const takimAdi of ['Çılgın Şimşekler', "Tom & Jerry's 07", 'Klasik Götürenler', 'Nazilli Gücü']) {
    const r = await istemci().iste('rezervasyon', { ...(await bosDilim()), takimAdi, rakipAriyor: true })
    kontrol(8, `kabul edilir: ${takimAdi}`, r.durum === 200, `HTTP ${r.durum}`)
  }
  const n = sql(`SELECT count(*) FROM kayitlar WHERE takim_adi ~ '[<>]' OR rakip_takim_adi ~ '[<>]'`)
  kontrol(8, 'veritabanında < ya da > içeren takım adı yok (HTML saklanamaz)', n === '0', `count = ${n}`)
  const buyuk = await istemci().iste('rezervasyon', JSON.stringify({ ...d, takimAdi: 'x'.repeat(10_000) }))
  kontrol(8, 'aşırı büyük istek gövdesi reddedilir', buyuk.durum === 413, `HTTP ${buyuk.durum}`)
}

// ---------- K9: panel yetkisi ----------
let panel
{
  const c = istemci()
  const acik = [
    await c.iste('panel/gun'),
    await c.iste('panel/iptal', { id: 1 }),
    await c.iste('panel/kapat', { saha: 'acik', tarih: gunler[0], saatler: [20] }),
    await c.iste('panel/ac', { id: 1 }),
  ]
  kontrol(9, 'panel uçları oturumsuz istekte 401 döner ve veri vermez', acik.every((y) => y.durum === 401 && !y.veri.sahalar), acik.map((y) => y.durum).join(' '))
  const sahte = await istemci(yeniIp(), 'panel_oturumu=99999999999999.deadbeef').iste('panel/gun')
  kontrol(9, 'uydurma oturum çerezi kabul edilmez', sahte.durum === 401, `HTTP ${sahte.durum}`)
  const sayfa = await (await fetch(`${TABAN}/panel`)).text()
  kontrol(9, 'panel sayfası oturumsuz açılınca yalnız giriş formunu verir', sayfa.includes('Panel şifresi') && !sayfa.includes('Çıkış'))

  const yanlislar = []
  for (let n = 0; n < 6; n++) yanlislar.push((await c.iste('panel/giris', { sifre: 'yanlis-sifre-' + n })).durum)
  kontrol(9, '5 yanlış şifreden sonra giriş geçici olarak reddedilir', yanlislar.slice(0, 5).every((s) => s === 401) && yanlislar[5] === 429, yanlislar.join(' '))
  const kilitli = await c.iste('panel/giris', { sifre: SIFRE })
  kontrol(9, 'kilitliyken doğru şifre de reddedilir (deneme yanılma işe yaramaz)', kilitli.durum === 429, `HTTP ${kilitli.durum} "${kilitli.veri.mesaj}"`)

  const giris = await istemci().iste('panel/giris', { sifre: SIFRE })
  const cerez = giris.basliklar.get('set-cookie') ?? ''
  kontrol(9, 'doğru şifreyle giriş yapılır; çerez HttpOnly, Secure, SameSite=Strict ve 12 saatlik', giris.durum === 200 && /HttpOnly/i.test(cerez) && /Secure/i.test(cerez) && /SameSite=strict/i.test(cerez) && /Max-Age=43200/i.test(cerez), cerez.replace(/=[^;]+/, '=…'))
  panel = istemci(yeniIp(), cerez.split(';')[0])
  const gun = await panel.iste('panel/gun')
  kontrol(9, 'oturumla gün dökümü alınır', gun.durum === 200 && gun.veri.sahalar.acik.length > 0, `HTTP ${gun.durum}`)
  const csrf = await panel.iste('panel/iptal', { id: 1 }, { Origin: 'https://kotu-site.example' })
  kontrol(9, 'başka siteden gelen (Origin uyuşmayan) istek reddedilir', csrf.durum === 403 && csrf.veri.hata === 'kaynak', `HTTP ${csrf.durum}`)
}

// ---------- K10: işletmeci işlemleri ----------
{
  const takim = istemci()
  const d = await bosDilim()
  const r = await takim.iste('rezervasyon', { ...d, takimAdi: 'Panel Sinamasi', rakipAriyor: true })
  const satir = async (x) => (await panel.iste(`panel/gun?tarih=${x.tarih}`)).veri.sahalar[x.saha].find((s) => s.saat === x.saat)
  const s = await satir(d)
  const gun = (await panel.iste(`panel/gun?tarih=${d.tarih}`)).veri
  kontrol(10, 'işletmeci seçtiği günün iki sahasını takım adlarıyla görür', gun.sahalar.acik.length === 15 && gun.sahalar.kapali.length === 15 && s.takimAdi === 'Panel Sinamasi' && s.rakipAriyor === true, `açık ${gun.sahalar.acik.length} dilim, kapalı ${gun.sahalar.kapali.length} dilim; ${d.saat}:00 → ${s.takimAdi}`)

  const i = await panel.iste('panel/iptal', { id: s.id })
  const g = await takim.iste('kod', { kod: r.veri.kod })
  kontrol(10, 'işletmeci rezervasyonu iptal eder; takımın kodu "işletmeci iptal etti" gösterir', i.durum === 200 && g.veri.durum === 'iptal' && g.veri.iptalEden === 'isletmeci', `${g.veri.durum} / ${g.veri.iptalEden}`)

  const k = await panel.iste('panel/kapat', { saha: d.saha, tarih: d.tarih, saatler: [d.saat], not: 'Zemin bakımı' })
  const kapali = await satir(d)
  kontrol(10, 'işletmeci saati notla kapatır', k.durum === 200 && k.veri.kapatilan[0] === d.saat && kapali.durum === 'bakim' && kapali.not === 'Zemin bakımı', JSON.stringify(k.veri))
  const alinamaz = await istemci().iste('rezervasyon', { ...d, takimAdi: 'Bakimda Deneyen', rakipAriyor: false })
  kontrol(10, 'kapalı saati takım alamaz, listede "bakımda" görünür', alinamaz.durum === 409 && (await durumu(d)).durum === 'bakim', `HTTP ${alinamaz.durum}, dilim: ${(await durumu(d)).durum}`)

  const dolu = await bosDilim()
  await istemci().iste('rezervasyon', { ...dolu, takimAdi: 'Yerinde Kalan', rakipAriyor: false })
  const dk = await panel.iste('panel/kapat', { saha: dolu.saha, tarih: dolu.tarih, saatler: [dolu.saat] })
  kontrol(10, 'dolu saat kapatılamaz, rezervasyon yerinde kalır', dk.veri.dolu?.[0] === dolu.saat && (await satir(dolu)).takimAdi === 'Yerinde Kalan', JSON.stringify(dk.veri))

  const a = await panel.iste('panel/ac', { id: kapali.id })
  const yeniden = await istemci().iste('rezervasyon', { ...d, takimAdi: 'Acilinca Alan', rakipAriyor: false })
  kontrol(10, 'işletmeci saati yeniden açar, saat alınabilir', a.durum === 200 && yeniden.durum === 200, `aç: HTTP ${a.durum}, rezervasyon: HTTP ${yeniden.durum}`)

  const cikis = await panel.iste('panel/cikis', {})
  kontrol(10, 'çıkış oturum çerezini siler', /Max-Age=0/i.test(cikis.basliklar.get('set-cookie') ?? ''), (cikis.basliklar.get('set-cookie') ?? '').slice(0, 40))
}

// ---------- K11: kişisel veri yok ----------
{
  const c = istemci('203.0.113.77')
  const r = await c.iste('rezervasyon', { ...(await bosDilim()), takimAdi: 'Gizlilik Sinamasi', rakipAriyor: false })
  const kod = r.veri.kod
  const dokum = sql('SELECT row_to_json(k) FROM kayitlar k')
  kontrol(11, 'veritabanında düz rezervasyon kodu yok', kod && !dokum.includes(kod), `kod tüm satırlarda arandı (${dokum.split('\n').length} satır)`)
  kontrol(11, 'veritabanında düz IP adresi yok', !dokum.includes('203.0.113.77') && !/"ip_ozeti":"(\d+\.){3}\d+"/.test(dokum) && !/\b10\.\d+\.\d+\.\d+\b/.test(dokum), 'istemci IP\'leri tüm satırlarda arandı')
  const ornek = sql(`SELECT kod_ozeti || ' | ' || ip_ozeti FROM kayitlar WHERE takim_adi = 'Gizlilik Sinamasi'`)
  kontrol(11, 'kod ve IP yalnız 64 haneli HMAC özeti olarak saklanır', /^[0-9a-f]{64} \| [0-9a-f]{64}$/.test(ornek), ornek.replace(/([0-9a-f]{10})[0-9a-f]{54}/g, '$1…'))
  const sutunlar = sql(`SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_name = 'kayitlar'`)
  kontrol(11, 'şemada ad, telefon ya da e-posta sütunu yok', !/telefon|eposta|email|mail|phone|soyad|tc_/i.test(sutunlar), sutunlar)
  let alanlar = ''
  for (const yol of ['/', '/rakip', '/kod']) alanlar += await (await fetch(TABAN + yol)).text()
  kontrol(11, 'takım ekranlarında telefon ya da e-posta giriş alanı yok', !/type="(tel|email)"/i.test(alanlar) && !/name="(telefon|eposta|email|phone)"/i.test(alanlar))
}

console.log(hatalar ? `\n${hatalar} KONTROL KALDI` : '\nBÜTÜN KONTROLLER GEÇTİ')
process.exit(hatalar ? 1 : 0)
