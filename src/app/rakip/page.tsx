'use client'

import Link from 'next/link'
import { useState } from 'react'
import { SAHALAR, type Saha } from '@/lib/sahalar'
import { TakimCekmecesi, aralikYaz, api, gunYaz, saatYaz, useYenile } from '../ortak'

type Mac = { id: number; saha: Saha; tarih: string; saat: number; takimAdi: string }

export default function RakipBul() {
  const [maclar, setMaclar] = useState<Mac[] | null>(null)
  const [hata, setHata] = useState('')
  const [secili, setSecili] = useState<Mac | null>(null)

  async function yukle() {
    const y = await api<{ maclar: Mac[] }>('rakip-arayanlar')
    if (y.ok) setMaclar(y.maclar)
    setHata(y.ok ? '' : y.mesaj)
  }
  useYenile(yukle, '')

  return (
    <>
      <h1>Rakip bul</h1>
      <p className="alt">Rakip arayan maçlar. Takım adını yaz, anında eşleş.</p>

      {hata && (
        <p className="uyari" role="alert">
          {hata}
        </p>
      )}

      {maclar?.length === 0 && (
        <div className="bos-durum">
          <h2>Şu an rakip arayan yok</h2>
          <p>Bir saat al ve “Rakip arıyoruz” işaretle; ilanın burada görünsün.</p>
          <Link href="/" className="dugme ana">
            Saatlere bak
          </Link>
        </div>
      )}

      {maclar?.map((m, i) => (
        <div key={m.id}>
          {m.tarih !== maclar[i - 1]?.tarih && <p className="gun-ayirici">{gunYaz(m.tarih)}</p>}
          <article className="kart">
            <div className="mac">
              <div className="saat">
                {saatYaz(m.saat)}
                <small>{SAHALAR[m.saha]}</small>
              </div>
              <div className="takim">
                {m.takimAdi}
                <small>rakip arıyor</small>
              </div>
            </div>
            <div className="dugmeler">
              <button type="button" className="dugme ana tam" onClick={() => setSecili(m)}>
                Rakip ol
              </button>
            </div>
          </article>
        </div>
      ))}

      {secili && (
        <TakimCekmecesi
          key={secili.id}
          etiket={`${secili.takimAdi} rakip arıyor`}
          baslik={aralikYaz(secili.saat)}
          ayrinti={`${gunYaz(secili.tarih)} · ${SAHALAR[secili.saha]}`}
          dugme="Rakip ol"
          gonder={async (takimAdi) => {
            const y = await api<{ kod: string }>('rakip-katil', { id: secili.id, takimAdi })
            void yukle()
            return y
          }}
          kapat={() => setSecili(null)}
        />
      )}
    </>
  )
}
