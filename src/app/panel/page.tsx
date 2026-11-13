import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { CEREZ, oturumGecerli } from '@/lib/oturum'
import { Panel } from './Panel'

export const metadata: Metadata = { title: 'İşletmeci Paneli', robots: { index: false } }

// Burası yalnız hangi ekranın açılacağını seçer; asıl yetki denetimi her panel ucunda yapılır.
export default async function PanelSayfasi() {
  const girisli = oturumGecerli((await cookies()).get(CEREZ)?.value)
  return <Panel girisli={girisli} />
}
