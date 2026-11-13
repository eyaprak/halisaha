import { ayarlar } from './ayarlar'
import { cekirdek, havuz } from './db'
import { gocleriUygula } from './gocler'

export async function baslat() {
  try {
    ayarlar()
    await gocleriUygula(havuz())
  } catch (e) {
    // Eksik gizli değerle ya da şemasız çalışmaktansa hiç başlamamak daha güvenli.
    console.error('BAŞLATILAMADI:', e instanceof Error ? e.message : e)
    process.exit(1)
  }
  const temizle = () =>
    cekirdek()
      .eskiKayitlariSil(new Date())
      .catch((e) => console.error('Eski kayıt temizliği başarısız:', e))
  void temizle()
  setInterval(temizle, 60 * 60 * 1000).unref()
  console.log('Ayarlar doğrulandı, veritabanı şeması güncel.')
}
