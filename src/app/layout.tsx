import type { Metadata, Viewport } from 'next'
import { Barlow_Condensed, Familjen_Grotesk } from 'next/font/google'
import Link from 'next/link'
import type { ReactNode } from 'react'
import './globals.css'
import { Gezinti } from './ortak'

const baslik = Barlow_Condensed({ subsets: ['latin', 'latin-ext'], weight: ['700', '800', '900'], variable: '--f-baslik', display: 'swap' })
const govde = Familjen_Grotesk({ subsets: ['latin', 'latin-ext'], variable: '--f-govde', display: 'swap' })

export const metadata: Metadata = {
  title: 'Halı Saha Rezervasyon',
  description: 'Mahalle halı sahasında boş saati gör, takım adını yaz, kodunu al. Üyelik yok.',
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0c3024' }

export default function Kabuk({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" className={`${baslik.variable} ${govde.variable}`}>
      <body>
        <div className="kabuk">
          <header className="ust">
            <Link href="/" className="marka">
              <b>Halı Saha</b>
              <span>Mahalle · Açık + Kapalı</span>
            </Link>
          </header>
          <main>{children}</main>
          <footer className="dip">
            <Link href="/panel">İşletmeci girişi</Link>
          </footer>
        </div>
        <Gezinti />
      </body>
    </html>
  )
}
