'use client'

import { useState, type FormEvent } from 'react'
import type { KodKaydi } from '@/lib/cekirdek'
import { SAHALAR } from '@/lib/sahalar'
import { OnayliDugme, aralikYaz, api, gunYaz } from '../ortak'

function durumYaz(k: KodKaydi): [sinif: string, etiket: string, aciklama: string] {
  if (k.durum === 'iptal') {
    if (k.iptalEden === 'isletmeci') return ['iptal', 'İptal edildi', 'Bu maçı işletmeci iptal etti. Sahaya gitme.']
    return k.rol === 'rakip'
      ? ['iptal', 'İptal edildi', 'Ev sahibi takım maçı iptal etti. Sahaya gitme.']
      : ['iptal', 'İptal edildi', 'Bu rezervasyonu iptal ettin. Saat başkalarına açıldı.']
  }
  if (k.basladi) return ['bitti', 'Maç saati geldi', 'Maç başladığı için artık değişiklik yapılamıyor.']
  return ['', 'Aktif', k.rol === 'rakip' ? 'Bu maça rakip olarak katıldın.' : 'Saha bu saatte senin.']
}

export default function Kodum() {
  const [kod, setKod] = useState('')
  const [kayit, setKayit] = useState<KodKaydi | null>(null)
  const [mesaj, setMesaj] = useState('')
  const [bilgi, setBilgi] = useState('')
  const [bekliyor, setBekliyor] = useState(false)

  async function getir() {
    const y = await api<KodKaydi>('kod', { kod })
    setBilgi('')
    setKayit(y.ok ? y : null)
    setMesaj(y.ok ? '' : y.mesaj)
  }

  async function goster(e: FormEvent) {
    e.preventDefault()
    setBekliyor(true)
    await getir()
    setBekliyor(false)
  }

  async function yap(yol: string, ek: object = {}) {
    const y = await api(yol, { kod, ...ek })
    if (yol === 'kod/ayril' && y.ok) {
      setKayit(null)
      setBilgi('Maçtan ayrıldın. Ev sahibi yeniden rakip arayabilir.')
      return
    }
    await getir() // başarısız olsa da güncel durumu göster
    if (!y.ok) setMesaj(y.mesaj)
  }

  const degisebilir = kayit && kayit.durum === 'aktif' && !kayit.basladi
  const [sinif, etiket, aciklama] = kayit ? durumYaz(kayit) : ['', '', '']

  return (
    <>
      <h1>Rezervasyonum</h1>
      <p className="alt">Kodunu yaz; rezervasyonunu gör, gerekirse iptal et.</p>

      <form onSubmit={goster}>
        <label className="alan">
          <span>Rezervasyon kodu (8 karakter)</span>
          <input
            className="kod-girisi"
            value={kod}
            onChange={(e) => setKod(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
            placeholder="········"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            required
            minLength={8}
            aria-describedby="kod-notu"
          />
        </label>
        <button className="dugme ana tam" disabled={bekliyor}>
          {bekliyor ? 'Bakılıyor…' : 'Göster'}
        </button>
      </form>

      {mesaj && (
        <p className="uyari" role="alert">
          {mesaj}
        </p>
      )}
      {bilgi && (
        <p className="bilgi" role="status">
          {bilgi}
        </p>
      )}

      {kayit && (
        <section className="kart" aria-live="polite">
          <span className={`durum ${sinif}`}>{etiket}</span>
          <h2 style={{ marginTop: 10, fontSize: 32 }}>{aralikYaz(kayit.saat)}</h2>
          <p className="alt">{aciklama}</p>
          <dl className="bilgiler">
            <dt>Gün</dt>
            <dd>{gunYaz(kayit.tarih)}</dd>
            <dt>Saha</dt>
            <dd>{SAHALAR[kayit.saha]}</dd>
            <dt>{kayit.rol === 'rakip' ? 'Ev sahibi' : 'Takımın'}</dt>
            <dd>{kayit.takimAdi}</dd>
            <dt>{kayit.rol === 'rakip' ? 'Takımın' : 'Rakip'}</dt>
            <dd>{kayit.rakipTakimAdi ?? (kayit.rakipAriyor ? 'Aranıyor, ilan açık' : 'Yok')}</dd>
          </dl>

          {degisebilir && kayit.rol === 'ev_sahibi' && (
            <div className="dugmeler">
              {!kayit.rakipTakimAdi && (
                <button type="button" className="dugme cizgili tam" onClick={() => yap('kod/rakip-arama', { acik: !kayit.rakipAriyor })}>
                  {kayit.rakipAriyor ? 'Rakip ilanını kapat' : 'Rakip arıyoruz diye işaretle'}
                </button>
              )}
              <OnayliDugme
                etiket="Rezervasyonu iptal et"
                soru={`Saat boşalacak${kayit.rakipTakimAdi ? ' ve rakibin maçı da iptal olacak' : ''}. Emin misin?`}
                onayEtiketi="İptal et"
                islem={() => yap('kod/iptal')}
              />
            </div>
          )}
          {degisebilir && kayit.rol === 'rakip' && (
            <div className="dugmeler">
              <OnayliDugme
                etiket="Maçtan ayrıl"
                soru="Ev sahibi yeniden rakip arayacak ve bu kod geçersiz olacak. Emin misin?"
                onayEtiketi="Evet, ayrıl"
                islem={() => yap('kod/ayril')}
              />
            </div>
          )}
        </section>
      )}

      <p className="not" id="kod-notu">
        Kodunu kaybettiysen sahadaki işletmeciye haber ver; rezervasyonu panelden iptal edebilir.
      </p>
    </>
  )
}
