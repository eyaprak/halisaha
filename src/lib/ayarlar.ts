// Ortam değişkenlerinden ayarlar. Eksik ya da zayıf gizli değerle uygulama başlamaz.
export type OrtamAyarlari = {
  panelSifresi: string
  oturumAnahtari: string
  ipOzetAnahtari: string
  acilis: number
  kapanis: number
  gunSayisi: number
  ipSiniri: number
  vekilSayisi: number
}

let bellek: OrtamAyarlari | undefined

export function ayarlar(): OrtamAyarlari {
  if (bellek) return bellek
  const e = process.env
  const sorunlar: string[] = []

  const gizli = (ad: string, enAz: number) => {
    const v = e[ad] ?? ''
    if (v.length < enAz) sorunlar.push(`${ad} ${v ? `çok kısa (en az ${enAz} karakter)` : 'tanımlı değil'}`)
    return v
  }
  const sayi = (ad: string, varsayilan: number, enAz: number, enCok: number) => {
    const ham = e[ad]
    const v = ham === undefined || ham === '' ? varsayilan : Number(ham)
    if (!Number.isInteger(v) || v < enAz || v > enCok) sorunlar.push(`${ad} ${enAz}-${enCok} arasında tam sayı olmalı`)
    return v
  }

  const a: OrtamAyarlari = {
    panelSifresi: gizli('PANEL_SIFRESI', 10),
    oturumAnahtari: gizli('OTURUM_ANAHTARI', 32),
    ipOzetAnahtari: gizli('IP_OZET_ANAHTARI', 32),
    acilis: sayi('ACILIS_SAATI', 9, 0, 23),
    kapanis: sayi('KAPANIS_SAATI', 24, 1, 24),
    gunSayisi: sayi('GUN_SAYISI', 7, 1, 30),
    ipSiniri: sayi('IP_SINIRI', 3, 1, 1000),
    vekilSayisi: sayi('GUVENILIR_VEKIL_SAYISI', 0, 0, 5),
  }
  if (a.acilis >= a.kapanis) sorunlar.push('ACILIS_SAATI, KAPANIS_SAATI değerinden küçük olmalı')
  if (sorunlar.length) throw new Error('Ayar hatası: ' + sorunlar.join('; '))
  return (bellek = a)
}
