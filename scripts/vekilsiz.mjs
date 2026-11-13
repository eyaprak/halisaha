// Vekilsiz kurulumda (GUVENILIR_VEKIL_SAYISI=0) sınırların gerçek soket adresine göre işlediğini,
// X-Forwarded-For uydurarak aşılamadığını doğrular. Her istek başka bir sahte adres gönderir.
//
//   docker compose up -d            (GUVENILIR_VEKIL_SAYISI=0)
//   node scripts/vekilsiz.mjs
const TABAN = process.env.TABAN ?? 'http://localhost:3000'
let n = 0
const iste = async (yol, govde) => {
  const y = await fetch(`${TABAN}/api/${yol}`, {
    method: govde ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${++n}` },
    body: govde && JSON.stringify(govde),
  })
  return { durum: y.status, veri: await y.json() }
}

let hatalar = 0
const kontrol = (ad, kosul, kanit) => {
  if (!kosul) hatalar++
  console.log(`${kosul ? 'GEÇTİ ' : 'KALDI '} ${ad}  →  ${kanit}`)
}

const { veri } = await iste('uygunluk')
const tarih = veri.gunler.at(-1)
const bos = (await iste(`uygunluk?tarih=${tarih}`)).veri.sahalar.acik.filter((d) => d.durum === 'bos').map((d) => d.saat)

const al = (saat) => iste('rezervasyon', { saha: 'acik', tarih, saat, takimAdi: 'Sahte Baslik', rakipAriyor: false })
const ilk = [await al(bos[0]), await al(bos[1]), await al(bos[2])]
const dorduncu = await al(bos[3])
kontrol(
  'her istekte farklı sahte X-Forwarded-For gönderilse de 4. rezervasyon reddedilir',
  ilk.every((r) => r.durum === 200) && dorduncu.durum === 403 && dorduncu.veri.hata === 'sinir',
  `${ilk.map((r) => r.durum).join(' ')} ${dorduncu.durum} (${dorduncu.veri.hata})`,
)

const iptaller = []
for (const r of ilk) iptaller.push((await iste('kod/iptal', { kod: r.veri.kod })).durum)
const besinci = await al(bos[3])
kontrol('biri iptal edilince yenisi alınabilir', iptaller.every((d) => d === 200) && besinci.durum === 200, `iptaller: ${iptaller.join(' ')}, yeni rezervasyon: ${besinci.durum}`)

// Buraya kadar 8 yazma isteği gitti. 9 ve 10 geçer, 11 ve 12 hız limitine takılır.
const sel = [await iste('kod/iptal', { kod: besinci.veri.kod })]
for (let i = 0; i < 3; i++) sel.push(await al(99))
const durumlar = sel.map((r) => r.durum)
kontrol(
  'dakikada 10 yazmadan sonrası, sahte adreslere rağmen 429 döner',
  durumlar.join(' ') === '200 400 429 429',
  `9-12. istekler: ${durumlar.join(' ')} ("${sel.at(-1).veri.mesaj}")`,
)

console.log(hatalar ? `\n${hatalar} KONTROL KALDI` : '\nBÜTÜN KONTROLLER GEÇTİ')
process.exit(hatalar ? 1 : 0)
