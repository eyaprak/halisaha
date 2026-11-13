'use client'

import { useState, type CSSProperties } from 'react'
import type { Dilim } from '@/lib/cekirdek'
import { SAHALAR, type Saha } from '@/lib/sahalar'
import { TakimCekmecesi, aralikYaz, api, gunYaz, saatYaz, useYenile } from './ortak'

type Veri = { tarih: string; gunler: string[]; sahalar: Record<Saha, Dilim[]> }

// Gün hızlı değiştirilince geç gelen eski yanıtı ayırt etmek için istek sayacı.
let sonIstek = 0

const ETIKET: Record<Dilim['durum'], string> = {
  bos: 'Boş',
  dolu: 'Dolu',
  bakim: 'Bakımda',
  gecmis: 'Geçti',
  rakip_ariyor: 'Rakip arıyor',
}

export default function Saatler() {
  const [tarih, setTarih] = useState<string | null>(null) // null = bugün
  const [saha, setSaha] = useState<Saha>('acik')
  const [veri, setVeri] = useState<Veri | null>(null)
  const [hata, setHata] = useState('')
  const [secili, setSecili] = useState<Dilim | null>(null)

  async function yukle() {
    const no = ++sonIstek
    const y = await api<Veri>('uygunluk' + (tarih ? `?tarih=${tarih}` : ''))
    if (no !== sonIstek) return // gün hızlı değiştirildiyse eski yanıtı at
    if (y.ok) {
      setVeri(y)
      setHata('')
    } else if (y.hata === 'pencere_disi') setTarih(null) // gece yarısı gün döndü
    else setHata(y.mesaj)
  }
  useYenile(yukle, tarih ?? '')

  const gunler = veri?.gunler ?? []
  const aktifGun = tarih ?? gunler[0]
  const guncel = veri && veri.tarih === aktifGun ? veri : null
  const bosSayisi = (s: Saha) => guncel?.sahalar[s].filter((d) => d.durum === 'bos').length

  return (
    <>
      <h1>Saat seç</h1>
      <p className="alt">Boş saate dokun, takım adını yaz, kodunu al.</p>

      <div className="gunler">
        {gunler.map((g, i) => (
          <button key={g} type="button" className="gun" aria-pressed={g === aktifGun} aria-label={gunYaz(g)} onClick={() => setTarih(g)}>
            <small>{i === 0 ? 'Bugün' : gunYaz(g, { weekday: 'short' })}</small>
            <b>{gunYaz(g, { day: 'numeric' })}</b>
          </button>
        ))}
      </div>

      <div className="sahalar">
        {(Object.keys(SAHALAR) as Saha[]).map((s) => (
          <button key={s} type="button" className="saha" aria-pressed={s === saha} onClick={() => setSaha(s)}>
            <b>{SAHALAR[s]}</b>
            <small>{bosSayisi(s) === undefined ? '…' : `${bosSayisi(s)} boş saat`}</small>
          </button>
        ))}
      </div>

      {hata && (
        <p className="uyari" role="alert">
          {hata}
        </p>
      )}

      <div className="gun-basligi">
        <h2>{aktifGun ? gunYaz(aktifGun) : 'Yükleniyor'}</h2>
        <span>{SAHALAR[saha]}</span>
      </div>

      <div className="dilimler" aria-busy={!guncel}>
        {guncel
          ? guncel.sahalar[saha].map((d, i) => (
              <button
                key={`${guncel.tarih}-${saha}-${d.saat}`}
                type="button"
                className={`dilim ${d.durum}`}
                style={{ '--i': i } as CSSProperties}
                disabled={d.durum !== 'bos' && d.durum !== 'rakip_ariyor'}
                aria-label={`${aralikYaz(d.saat)}, ${ETIKET[d.durum]}${d.takimAdi ? `: ${d.takimAdi}` : ''}`}
                onClick={() => setSecili(d)}
              >
                <b>{saatYaz(d.saat)}</b>
                <span>
                  <small>{ETIKET[d.durum]}</small>
                  {d.takimAdi && <small>{d.takimAdi}</small>}
                </span>
              </button>
            ))
          : !hata && Array.from({ length: 15 }, (_, i) => <div key={i} className="dilim iskelet" />)}
      </div>

      <p className="aciklama">
        <span><i />Boş</span>
        <span><i className="t" />Rakip arıyor, katılabilirsin</span>
        <span><i className="d" />Dolu</span>
        <span><i className="b" />Bakımda</span>
      </p>

      {secili && guncel && (
        <TakimCekmecesi
          key={`${secili.durum}-${secili.saat}`}
          etiket={secili.durum === 'bos' ? 'Rezervasyon' : `${secili.takimAdi} rakip arıyor`}
          baslik={aralikYaz(secili.saat)}
          ayrinti={`${gunYaz(guncel.tarih)} · ${SAHALAR[saha]}`}
          dugme={secili.durum === 'bos' ? 'Saati al' : 'Rakip ol'}
          rakipSecenegi={secili.durum === 'bos'}
          gonder={async (takimAdi, rakipAriyor) => {
            const y =
              secili.durum === 'bos'
                ? await api<{ kod: string }>('rezervasyon', { saha, tarih: guncel.tarih, saat: secili.saat, takimAdi, rakipAriyor })
                : await api<{ kod: string }>('rakip-katil', { id: secili.id, takimAdi })
            void yukle() // başarılı da olsa, saat kapılmış da olsa liste güncellensin
            return y
          }}
          kapat={() => setSecili(null)}
        />
      )}
    </>
  )
}
