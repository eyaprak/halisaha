// Arayüzü gerçek bir tarayıcıda telefon genişliğinde dener (prd.md, kriter 13 ve ana akışlar).
// 375 pikselde bütün akışı yürütüp ekran görüntüsü alır; 360 ve 375 pikselde her ekranın
// yatay taşmasını ve en küçük dokunma hedefini ölçer.
//
//   npm i --no-save playwright-core
//   node --env-file=.env scripts/arayuz.mjs <ekran-görüntüsü-klasörü>
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const TABAN = process.env.TABAN ?? 'http://localhost:3000'
const CIKTI = process.argv[2] ?? 'ekran'
const SIFRE = process.env.PANEL_SIFRESI
if (!SIFRE) throw new Error('PANEL_SIFRESI gerekli: node --env-file=.env scripts/arayuz.mjs')
mkdirSync(CIKTI, { recursive: true })

const tarayici = await chromium.launch({ channel: process.env.TARAYICI ?? 'msedge' })
async function telefon(genislik) {
  const baglam = await tarayici.newContext({
    viewport: { width: genislik, height: 760 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'tr-TR',
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const sayfa = await baglam.newPage()
  sayfa.on('pageerror', (e) => {
    throw e
  })
  return sayfa
}

let hatalar = 0
function kontrol(ad, kosul, kanit = '') {
  if (!kosul) hatalar++
  console.log(`${kosul ? 'GEÇTİ ' : 'KALDI '} ${ad}${kanit ? `  →  ${kanit}` : ''}`)
}
let cekimNo = 0
const cek = (sayfa, ad) => sayfa.screenshot({ path: `${CIKTI}/${String(++cekimNo).padStart(2, '0')}-${ad}.png` })
const kodOku = async (sayfa) => (await sayfa.locator('.kod span').allInnerTexts()).join('')

// Görünen her etkileşimli öğenin dokunma alanını ölçer. Onay kutusunda alan, kutuyu saran etikettir.
const olc = (sayfa) =>
  sayfa.evaluate(() => {
    const hedefler = [...document.querySelectorAll('a, button, input, select, textarea')]
      .map((e) => {
        const alan = e.type === 'checkbox' ? e.closest('label') : e
        const r = alan.getBoundingClientRect()
        return { ad: (e.innerText || e.getAttribute('aria-label') || e.placeholder || e.type || '').trim().slice(0, 28), yukseklik: Math.round(r.height * 10) / 10, genislik: r.width }
      })
      .filter((h) => h.genislik > 0 && h.yukseklik > 0)
      .sort((a, b) => a.yukseklik - b.yukseklik)
    return { icerik: document.documentElement.scrollWidth, pencere: window.innerWidth, sayi: hedefler.length, enKucuk: hedefler[0], kucukler: hedefler.filter((h) => h.yukseklik < 44) }
  })
async function olcVeYaz(sayfa, ekran) {
  const o = await olc(sayfa)
  kontrol(
    `${o.pencere}px · ${ekran}: yatay kaydırma yok, dokunma hedefleri ≥ 44px`,
    o.icerik <= o.pencere && o.kucukler.length === 0,
    `içerik ${o.icerik}px / pencere ${o.pencere}px; ${o.sayi} hedef, en küçüğü ${o.enKucuk.yukseklik}px ("${o.enKucuk.ad}")${o.kucukler.length ? ' KÜÇÜKLER: ' + JSON.stringify(o.kucukler) : ''}`,
  )
}

// ================= 375 piksel: bütün akış =================
const s = await telefon(375)

await s.goto(TABAN)
await s.locator('.dilim.bos').first().waitFor()
await s.waitForTimeout(700) // giriş animasyonu bitsin
await cek(s, 'saatler')
kontrol('saatler ekranı 7 gün ve iki saha gösterir', (await s.locator('.gun').count()) === 7 && (await s.locator('.saha').count()) === 2)

// Rezervasyon: 5. gün, kapalı saha, ilk boş saat, "rakip arıyoruz" işaretli.
await s.locator('.gun').nth(4).tap()
await s.getByRole('button', { name: /Kapalı Saha/ }).tap()
await s.locator('.dilim.bos').first().waitFor()
const saat = await s.locator('.dilim.bos b').first().innerText()
await s.locator('.dilim.bos').first().tap()
await s.locator('dialog[open]').waitFor()
await s.getByRole('textbox', { name: 'Takım adı' }).fill('Ekran Denemesi')
await s.getByText('Rakip arıyoruz', { exact: true }).tap()
await s.waitForTimeout(300)
await cek(s, 'rezervasyon-formu')
await s.getByRole('button', { name: 'Saati al' }).tap()
await s.locator('.kod').waitFor()
const kod1 = await kodOku(s)
await s.waitForTimeout(600)
await cek(s, 'kod-ekrani')
kontrol('rezervasyon sonrası 8 karakterlik kod gösterilir', /^[A-Z2-9]{8}$/.test(kod1), `${saat} için kod alındı`)
await s.keyboard.press('Escape')
kontrol('kod ekranı Esc ile yanlışlıkla kapanmaz', await s.locator('dialog[open]').isVisible())
await s.getByRole('button', { name: 'Kodu kopyala' }).tap()
await s.getByRole('button', { name: /Kopyalandı/ }).waitFor()
kontrol('kod tek dokunuşla panoya kopyalanır', (await s.evaluate(() => navigator.clipboard.readText())) === kod1)
await s.getByRole('button', { name: 'Kaydettim, kapat' }).tap()
await s.locator('.dilim.rakip_ariyor').first().waitFor()
await cek(s, 'saat-rakip-ariyor')
kontrol('alınan saat listede "rakip arıyor" olarak takım adıyla görünür', (await s.locator('.dilim.rakip_ariyor').first().innerText()).includes('Ekran Denemesi'))

// Rakip bul: ilana katıl.
await s.getByRole('link', { name: 'Rakip Bul' }).tap()
const ilan = s.locator('.kart', { hasText: 'Ekran Denemesi' })
await ilan.waitFor()
await cek(s, 'rakip-listesi')
await ilan.getByRole('button', { name: 'Rakip ol' }).tap()
await s.getByRole('textbox', { name: 'Takım adı' }).fill("Tom & Jerry's")
await s.getByRole('button', { name: 'Rakip ol' }).last().tap()
await s.locator('.kod').waitFor()
const kod2 = await kodOku(s)
kontrol('rakip katılınca kendi kodunu alır', /^[A-Z2-9]{8}$/.test(kod2) && kod2 !== kod1)
await s.getByRole('button', { name: 'Kaydettim, kapat' }).tap()
await ilan.waitFor({ state: 'detached' })
kontrol('eşleşen maç rakip listesinden düşer', (await ilan.count()) === 0)

// Kodum: görüntüle, iptal et.
await s.getByRole('link', { name: 'Kodum' }).tap()
await s.getByLabel(/Rezervasyon kodu/).fill(kod1.toLowerCase())
await s.getByRole('button', { name: 'Göster' }).tap()
await s.locator('section.kart').waitFor()
await s.waitForTimeout(300)
await cek(s, 'rezervasyonum')
const kart = await s.locator('section.kart').innerText()
kontrol('kodla rezervasyon ve rakip takım görünür', kart.includes('Ekran Denemesi') && kart.includes("Tom & Jerry's") && kart.includes('Kapalı Saha'))
kontrol('özel karakterli takım adı metin olarak basılır (HTML işlenmez)', (await s.locator('section.kart dd').nth(3).innerHTML()) === 'Tom &amp; Jerry\'s')
await s.getByRole('button', { name: 'Rezervasyonu iptal et' }).tap()
await cek(s, 'iptal-onayi')
await s.waitForTimeout(500)
await cek(s, 'iptal-onayi-kaydirilmis')
kontrol('iptalden önce onay sorulur', await s.getByRole('button', { name: 'İptal et', exact: true }).isVisible())
await s.getByRole('button', { name: 'İptal et', exact: true }).tap()
await s.locator('.durum.iptal').waitFor()
await cek(s, 'iptal-edildi')
await s.getByLabel(/Rezervasyon kodu/).fill(kod2)
await s.getByRole('button', { name: 'Göster' }).tap()
await s.getByText('Ev sahibi takım maçı iptal etti').waitFor()
kontrol('rakip, kendi koduyla ev sahibinin iptalini görür', true)
await s.getByLabel(/Rezervasyon kodu/).fill('YANLIS22')
await s.getByRole('button', { name: 'Göster' }).tap()
await s.getByText('Bulunamadı').waitFor()
await cek(s, 'yanlis-kod')
kontrol('yanlış kodda yalnız "bulunamadı" mesajı çıkar', (await s.locator('section.kart').count()) === 0)

// İşletmeci paneli.
await s.getByRole('link', { name: 'İşletmeci girişi' }).tap()
await s.getByLabel('Panel şifresi').fill('yanlis-sifre')
await s.getByRole('button', { name: 'Giriş yap' }).tap()
await s.getByText('Şifre yanlış').waitFor()
await cek(s, 'panel-giris')
await s.getByLabel('Panel şifresi').fill(SIFRE)
await s.getByRole('button', { name: 'Giriş yap' }).tap()
await s.locator('.panel-saha').first().waitFor()
await s.getByRole('button', { name: 'Sonraki gün' }).tap()
await s.waitForTimeout(500)
await cek(s, 'panel-gun')
kontrol('panel iki sahayı ayrı ayrı listeler', (await s.locator('.panel-saha').count()) === 2)
await s.locator('label.satir').nth(0).tap()
await s.locator('label.satir').nth(1).tap()
await s.getByLabel(/Not/).fill('Zemin bakımı')
await cek(s, 'panel-saat-secimi')
await s.locator('.cubuk').getByRole('button', { name: 'Kapat' }).tap()
await s.locator('.satir.bakim').nth(1).waitFor()
await s.waitForTimeout(300)
await cek(s, 'panel-bakim')
kontrol('seçilen iki saat notla bakıma kapatılır', (await s.locator('.satir.bakim').count()) === 2 && (await s.locator('.satir.bakim').first().innerText()).includes('Zemin bakımı'))
await s.reload()
await s.locator('.panel-saha').first().waitFor()
kontrol('sayfa yenilenince oturum sürer (çerez tarayıcıda kabul edildi)', true)
await s.getByRole('button', { name: 'Sonraki gün' }).tap()
await s.locator('.satir.bakim').first().waitFor()
await s.getByRole('button', { name: 'Aç', exact: true }).first().tap()
await s.locator('.satir.bakim').nth(1).waitFor({ state: 'detached' })
await s.getByRole('button', { name: 'Aç', exact: true }).first().tap()
await s.locator('.satir.bakim').first().waitFor({ state: 'detached' })
kontrol('kapatılan saatler yeniden açılır', (await s.locator('.satir.bakim').count()) === 0)
await s.getByRole('button', { name: 'Çıkış' }).tap()
await s.getByLabel('Panel şifresi').waitFor()
kontrol('çıkış yapınca giriş ekranına dönülür', true)
await s.context().close()

// ================= 360 ve 375 piksel: taşma ve dokunma hedefi ölçümü =================
for (const genislik of [360, 375]) {
  const p = await telefon(genislik)
  await p.goto(TABAN)
  await p.locator('.dilim.bos').first().waitFor()
  await olcVeYaz(p, 'saatler')
  await p.locator('.dilim.bos').last().tap()
  await p.locator('dialog[open]').waitFor()
  await p.waitForTimeout(350)
  await olcVeYaz(p, 'rezervasyon çekmecesi')
  if (genislik === 360) await cek(p, '360-cekmece')
  await p.getByRole('button', { name: 'Vazgeç' }).tap()

  await p.goto(TABAN + '/rakip')
  await p.locator('.kart, .bos-durum').first().waitFor()
  await olcVeYaz(p, 'rakip bul')

  await p.goto(TABAN + '/kod')
  await p.getByLabel(/Rezervasyon kodu/).fill(kod2)
  await p.getByRole('button', { name: 'Göster' }).tap()
  await p.locator('section.kart').waitFor()
  await olcVeYaz(p, 'rezervasyonum')

  await p.goto(TABAN + '/panel')
  await p.getByLabel('Panel şifresi').waitFor()
  await olcVeYaz(p, 'panel girişi')
  await p.getByLabel('Panel şifresi').fill(SIFRE)
  await p.getByRole('button', { name: 'Giriş yap' }).tap()
  await p.locator('.panel-saha').first().waitFor()
  await p.getByRole('button', { name: 'Sonraki gün' }).tap()
  await p.locator('label.satir').first().waitFor()
  await p.locator('label.satir').first().tap()
  await p.locator('.cubuk').waitFor()
  await olcVeYaz(p, 'panel (saat seçili)')
  if (genislik === 360) await cek(p, '360-panel')
  await p.context().close()
}

await tarayici.close()
console.log(hatalar ? `\n${hatalar} KONTROL KALDI` : '\nBÜTÜN ARAYÜZ KONTROLLERİ GEÇTİ')
process.exit(hatalar ? 1 : 0)
