'use client'

import { useState, type FormEvent } from 'react'
import type { PanelDilim } from '@/lib/cekirdek'
import { SAHALAR, type Saha } from '@/lib/sahalar'
import { gunEkle } from '@/lib/zaman'
import { OnayliDugme, api, gunYaz, saatYaz, useYenile } from '../ortak'

type Gun = { tarih: string; sahalar: Record<Saha, PanelDilim[]> }

// Gün hızlı değiştirilince geç gelen eski yanıtı ayırt etmek için istek sayacı.
let sonIstek = 0

export function Panel({ girisli: ilkGirisli }: { girisli: boolean }) {
  const [girisli, setGirisli] = useState(ilkGirisli)
  return girisli ? <GunGorunumu cikis={() => setGirisli(false)} /> : <Giris basarili={() => setGirisli(true)} />
}

function Giris({ basarili }: { basarili: () => void }) {
  const [sifre, setSifre] = useState('')
  const [mesaj, setMesaj] = useState('')
  const [bekliyor, setBekliyor] = useState(false)

  async function gir(e: FormEvent) {
    e.preventDefault()
    setBekliyor(true)
    const y = await api('panel/giris', { sifre })
    setBekliyor(false)
    if (y.ok) basarili()
    else setMesaj(y.mesaj)
  }

  return (
    <form onSubmit={gir}>
      <h1>İşletmeci girişi</h1>
      <p className="alt">Bu bölüm yalnız saha işletmecisi içindir.</p>
      <label className="alan">
        <span>Panel şifresi</span>
        <input type="password" value={sifre} onChange={(e) => setSifre(e.target.value)} autoComplete="current-password" required />
      </label>
      {mesaj && (
        <p className="uyari" role="alert">
          {mesaj}
        </p>
      )}
      <button className="dugme ana tam" disabled={bekliyor}>
        {bekliyor ? 'Bekle…' : 'Giriş yap'}
      </button>
    </form>
  )
}

function GunGorunumu({ cikis }: { cikis: () => void }) {
  const [tarih, setTarih] = useState<string | null>(null) // null = bugün
  const [gun, setGun] = useState<Gun | null>(null)
  const [mesaj, setMesaj] = useState('')
  const [secili, setSecili] = useState<Set<string>>(new Set()) // "saha:saat"
  const [not, setNot] = useState('')

  /** Oturum düştüyse giriş ekranına döner. */
  function oturumDustu(y: { ok: boolean; hata?: string }) {
    if (!y.ok && y.hata === 'oturum') cikis()
    return !y.ok
  }

  async function yukle() {
    const no = ++sonIstek
    const y = await api<Gun>('panel/gun' + (tarih ? `?tarih=${tarih}` : ''))
    if (no !== sonIstek) return
    if (y.ok) setGun(y)
    else if (oturumDustu(y)) setMesaj(y.mesaj)
  }
  useYenile(yukle, tarih ?? '')

  function gunDegistir(yeni: string | null) {
    setTarih(yeni)
    setSecili(new Set())
    setMesaj('')
  }

  async function yap(yol: string, govde: object) {
    const y = await api(yol, govde)
    setMesaj(y.ok ? '' : y.mesaj)
    oturumDustu(y)
    await yukle()
  }

  async function kapat() {
    if (!gun) return
    const dolular: string[] = []
    for (const saha of Object.keys(SAHALAR) as Saha[]) {
      const saatler = [...secili].filter((s) => s.startsWith(saha + ':')).map((s) => Number(s.split(':')[1]))
      if (!saatler.length) continue
      const y = await api<{ dolu: number[] }>('panel/kapat', { saha, tarih: gun.tarih, saatler, not })
      if (oturumDustu(y)) {
        if (!y.ok) setMesaj(y.mesaj)
        return
      }
      if (y.ok) dolular.push(...y.dolu.map((s) => `${SAHALAR[saha]} ${saatYaz(s)}`))
    }
    setMesaj(dolular.length ? `Şu saatler bu arada dolduğu için kapatılamadı: ${dolular.join(', ')}` : '')
    setSecili(new Set())
    setNot('')
    await yukle()
  }

  const sec = (anahtar: string, acik: boolean) =>
    setSecili((onceki) => {
      const yeni = new Set(onceki)
      if (acik) yeni.add(anahtar)
      else yeni.delete(anahtar)
      return yeni
    })

  return (
    <>
      <div className="panel-ust">
        <h1>Panel</h1>
        <button
          type="button"
          className="dugme cizgili kucuk"
          onClick={async () => {
            await api('panel/cikis', {})
            cikis()
          }}
        >
          Çıkış
        </button>
      </div>

      <div className="tarih-gezgini">
        <button type="button" className="dugme cizgili" aria-label="Önceki gün" disabled={!gun} onClick={() => gun && gunDegistir(gunEkle(gun.tarih, -1))}>
          ‹
        </button>
        <div>
          <b>{gun ? gunYaz(gun.tarih) : 'Yükleniyor'}</b>
          <small>{gun ? gunYaz(gun.tarih, { year: 'numeric' }) : ''}</small>
        </div>
        <button type="button" className="dugme cizgili" aria-label="Sonraki gün" disabled={!gun} onClick={() => gun && gunDegistir(gunEkle(gun.tarih, 1))}>
          ›
        </button>
      </div>
      {tarih && (
        <button type="button" className="dugme cizgili kucuk tam" onClick={() => gunDegistir(null)}>
          Bugüne dön
        </button>
      )}

      {mesaj && (
        <p className="uyari" role="alert">
          {mesaj}
        </p>
      )}

      {gun &&
        (Object.keys(SAHALAR) as Saha[]).map((saha) => {
          const dilimler = gun.sahalar[saha]
          return (
            <section key={saha} className="panel-saha">
              <header>
                <h2>{SAHALAR[saha]}</h2>
                <span>
                  {dilimler.filter((d) => d.durum === 'dolu').length} dolu · {dilimler.filter((d) => d.durum === 'bakim').length} bakım ·{' '}
                  {dilimler.filter((d) => d.durum === 'bos' && !d.gecmis).length} boş
                </span>
              </header>
              {dilimler.map((d) => {
                const anahtar = `${saha}:${d.saat}`
                const sinif = `satir ${d.durum}${d.gecmis ? ' gecmis' : ''}`
                if (d.durum === 'bos' && !d.gecmis)
                  return (
                    <label key={anahtar} className={sinif}>
                      <b>{saatYaz(d.saat)}</b>
                      <span className="icerik">Boş</span>
                      <input
                        type="checkbox"
                        aria-label={`${SAHALAR[saha]} ${saatYaz(d.saat)} bakım için seç`}
                        checked={secili.has(anahtar)}
                        onChange={(e) => sec(anahtar, e.target.checked)}
                      />
                    </label>
                  )
                return (
                  <div key={anahtar} className={sinif}>
                    <b>{saatYaz(d.saat)}</b>
                    <span className="icerik">
                      {d.durum === 'bos' && 'Boş geçti'}
                      {d.durum === 'bakim' && (
                        <>
                          Bakım için kapalı<small>{d.not ?? 'Not yok'}</small>
                        </>
                      )}
                      {d.durum === 'dolu' && (
                        <>
                          {d.takimAdi}
                          <small>{d.rakipTakimAdi ? `Rakip: ${d.rakipTakimAdi}` : d.rakipAriyor ? 'Rakip arıyor' : 'Rakip ilanı yok'}</small>
                        </>
                      )}
                    </span>
                    {d.durum === 'bakim' && !d.gecmis && (
                      <button type="button" className="dugme cizgili kucuk" onClick={() => yap('panel/ac', { id: d.id })}>
                        Aç
                      </button>
                    )}
                    {d.durum === 'dolu' && !d.gecmis && (
                      <OnayliDugme
                        kucuk
                        etiket="İptal"
                        soru={`${saatYaz(d.saat)} · ${d.takimAdi} rezervasyonu iptal edilecek. Emin misin?`}
                        onayEtiketi="İptal et"
                        islem={() => yap('panel/iptal', { id: d.id })}
                      />
                    )}
                  </div>
                )
              })}
            </section>
          )
        })}

      {secili.size > 0 && (
        <div className="cubuk">
          <b>{secili.size} saat bakım için kapatılacak</b>
          <label className="alan">
            <span>Not (isteğe bağlı)</span>
            <input value={not} onChange={(e) => setNot(e.target.value)} maxLength={80} placeholder="Örn. Zemin bakımı" />
          </label>
          <div className="dugmeler yan" style={{ marginTop: 0 }}>
            <button type="button" className="dugme cizgili" onClick={() => setSecili(new Set())}>
              Vazgeç
            </button>
            <button type="button" className="dugme ana" onClick={kapat}>
              Kapat
            </button>
          </div>
        </div>
      )}
    </>
  )
}
