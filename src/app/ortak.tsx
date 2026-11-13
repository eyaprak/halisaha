'use client'

// Sayfaların paylaştığı istemci parçaları: API çağrısı, biçimlendirme, gezinti, takım adı çekmecesi.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useEffectEvent, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'

export type Hatali = { ok: false; hata: string; mesaj: string }
export type Yanit<T> = ({ ok: true } & T) | Hatali

export async function api<T = object>(yol: string, govde?: unknown): Promise<Yanit<T>> {
  try {
    const y = await fetch(
      '/api/' + yol,
      govde === undefined
        ? { cache: 'no-store' }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) },
    )
    return (await y.json()) as Yanit<T>
  } catch {
    return { ok: false, hata: 'ag', mesaj: 'Bağlantı kurulamadı. İnternetini kontrol edip yeniden dene.' }
  }
}

export const saatYaz = (saat: number) => `${String(saat % 24).padStart(2, '0')}:00`
export const aralikYaz = (saat: number) => `${saatYaz(saat)}–${saatYaz(saat + 1)}`

export function gunYaz(
  tarih: string,
  bicim: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' },
) {
  return new Intl.DateTimeFormat('tr-TR', { ...bicim, timeZone: 'UTC' }).format(new Date(`${tarih}T00:00:00Z`))
}

/** Açılışta, anahtar değişince, 20 saniyede bir ve sekmeye dönülünce veriyi yeniler. */
export function useYenile(yukle: () => void, anahtar: string) {
  const cagir = useEffectEvent(yukle)
  useEffect(() => {
    cagir()
    const zamanlayici = setInterval(() => document.visibilityState === 'visible' && cagir(), 20_000)
    const gorunur = () => document.visibilityState === 'visible' && cagir()
    document.addEventListener('visibilitychange', gorunur)
    return () => {
      clearInterval(zamanlayici)
      document.removeEventListener('visibilitychange', gorunur)
    }
  }, [anahtar])
}

const OGELER: [yol: string, ad: string, ikon: ReactNode][] = [
  ['/', 'Saatler', <path key="s" d="M3 5h18v14H3zM12 5v14M12 9.5a2.5 2.5 0 0 0 0 5a2.5 2.5 0 0 0 0-5" />],
  ['/rakip', 'Rakip Bul', <path key="r" d="M4 4l7 7M4 4v4M4 4h4M20 4l-7 7M20 4v4M20 4h-4M7 14l-3 3l3 3l3-3M17 14l3 3l-3 3l-3-3" />],
  ['/kod', 'Kodum', <path key="k" d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM14 6v12" />],
]

export function Gezinti() {
  const yol = usePathname()
  return (
    <nav className="gezinti" aria-label="Ana gezinti">
      <div>
        {OGELER.map(([hedef, ad, ikon]) => (
          <Link key={hedef} href={hedef} aria-current={yol === hedef ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {ikon}
            </svg>
            {ad}
          </Link>
        ))}
      </div>
    </nav>
  )
}

/** İki adımlı onay: yanlışlıkla iptal olmasın. */
export function OnayliDugme({
  etiket,
  soru,
  onayEtiketi,
  islem,
  kucuk,
}: {
  etiket: string
  soru: string
  onayEtiketi: string
  islem: () => Promise<void>
  kucuk?: boolean
}) {
  const [soruluyor, setSoruluyor] = useState(false)
  const [bekliyor, setBekliyor] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (soruluyor) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [soruluyor])
  if (!soruluyor)
    return (
      <button type="button" className={`dugme tehlike ${kucuk ? 'kucuk' : 'tam'}`} onClick={() => setSoruluyor(true)}>
        {etiket}
      </button>
    )
  return (
    <div ref={ref} className="onay-grubu" role="group" aria-label={soru} style={kucuk ? { gridColumn: '1 / -1' } : undefined}>
      <p className="uyari" role="alert">
        {soru}
      </p>
      <div className="dugmeler yan" style={{ marginTop: 0 }}>
        <button type="button" className="dugme cizgili" disabled={bekliyor} onClick={() => setSoruluyor(false)}>
          Vazgeç
        </button>
        <button
          type="button"
          className="dugme tehlike dolgu"
          disabled={bekliyor}
          onClick={async () => {
            setBekliyor(true)
            await islem()
            setBekliyor(false)
            setSoruluyor(false)
          }}
        >
          {onayEtiketi}
        </button>
      </div>
    </div>
  )
}

/**
 * Takım adını soran alt çekmece. Başarılı olunca kodu skor tabelası gibi gösterir;
 * kod yalnız bir kez göründüğü için o aşamada yanlışlıkla kapanmaz.
 */
export function TakimCekmecesi({
  etiket,
  baslik,
  ayrinti,
  dugme,
  rakipSecenegi,
  gonder,
  kapat,
}: {
  etiket: string
  baslik: string
  ayrinti: string
  dugme: string
  rakipSecenegi?: boolean
  gonder: (takimAdi: string, rakipAriyor: boolean) => Promise<Yanit<{ kod: string }>>
  kapat: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [ad, setAd] = useState('')
  const [rakip, setRakip] = useState(false)
  const [mesaj, setMesaj] = useState('')
  const [bekliyor, setBekliyor] = useState(false)
  const [kod, setKod] = useState('')
  const [kopyalandi, setKopyalandi] = useState(false)

  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal()
  }, [])

  async function yolla(e: FormEvent) {
    e.preventDefault()
    setBekliyor(true)
    setMesaj('')
    const y = await gonder(ad, rakip)
    setBekliyor(false)
    if (y.ok) setKod(y.kod)
    else setMesaj(y.mesaj)
  }

  async function kopyala() {
    try {
      await navigator.clipboard.writeText(kod)
      setKopyalandi(true)
    } catch {
      setMesaj('Kopyalanamadı. Kodu elle not al.')
    }
  }

  return (
    <dialog
      ref={ref}
      className="cekmece"
      aria-labelledby="cekmece-baslik"
      onClose={kapat}
      onCancel={(e) => kod && e.preventDefault()}
      onClick={(e) => e.target === ref.current && !kod && ref.current.close()}
    >
      {kod ? (
        <>
          <p className="etiket">Tamamdır</p>
          <h2 id="cekmece-baslik">Kodun hazır</h2>
          <p className="alt">{ayrinti}</p>
          <div className="kod" role="img" aria-label={`Rezervasyon kodu: ${kod.split('').join(' ')}`}>
            {kod.split('').map((harf, i) => (
              <span key={i} style={{ '--i': i } as CSSProperties}>
                {harf}
              </span>
            ))}
          </div>
          <p className="bilgi">
            Bu kod <b>yalnız şimdi</b> gösteriliyor. Rezervasyonu görmek ve iptal etmek için bu koda ihtiyacın var; kaydetmeden kapatma.
          </p>
          {mesaj && (
            <p className="uyari" role="alert">
              {mesaj}
            </p>
          )}
          <div className="dugmeler">
            <button type="button" className="dugme ana tam" onClick={kopyala}>
              {kopyalandi ? 'Kopyalandı ✓' : 'Kodu kopyala'}
            </button>
            <button type="button" className="dugme cizgili tam" onClick={() => ref.current?.close()}>
              Kaydettim, kapat
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={yolla}>
          <p className="etiket">{etiket}</p>
          <h2 id="cekmece-baslik">{baslik}</h2>
          <p className="alt">{ayrinti}</p>
          <label className="alan">
            <span>Takım adı</span>
            <input
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              placeholder="Örn. Mahalle Gücü"
              minLength={2}
              maxLength={24}
              required
              autoFocus
              autoComplete="off"
              enterKeyHint="done"
            />
          </label>
          {rakipSecenegi && (
            <label className="onay">
              <input type="checkbox" checked={rakip} onChange={(e) => setRakip(e.target.checked)} />
              <span>
                <b>Rakip arıyoruz</b>
                <small>Maçın, takım adınla birlikte herkese açık listede görünür. Sonradan kapatabilirsin.</small>
              </span>
            </label>
          )}
          {mesaj && (
            <p className="uyari" role="alert">
              {mesaj}
            </p>
          )}
          <div className="dugmeler">
            <button className="dugme ana tam" disabled={bekliyor}>
              {bekliyor ? 'Bekle…' : dugme}
            </button>
            <button type="button" className="dugme cizgili tam" onClick={() => ref.current?.close()}>
              Vazgeç
            </button>
          </div>
          <p className="not">Üyelik, telefon ya da e-posta istemiyoruz. Yalnız takım adı yeter.</p>
        </form>
      )}
    </dialog>
  )
}
