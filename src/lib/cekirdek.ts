// Rezervasyon çekirdeği: bütün iş kuralları burada. HTTP'den habersizdir;
// "şimdi" ve istemci (IP) özeti parametre olarak gelir.
import { createHmac, randomInt } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import { SAHALAR, type Saha } from './sahalar'
import { gunEkle, istanbul, tarihGecerli } from './zaman'

export { SAHALAR, type Saha }

export type Ayarlar = {
  acilis: number // ilk dilimin başlangıç saati
  kapanis: number // son dilimin bitiş saati (24 = gece yarısı)
  gunSayisi: number // bugün dahil rezervasyona açık gün
  ipSiniri: number // IP başına aynı anda aktif, gelecekteki kayıt
  ozetAnahtari: string
}

export type Hata =
  | 'gecersiz'
  | 'pencere_disi'
  | 'gecmis_saat'
  | 'dolu'
  | 'sinir'
  | 'bulunamadi'
  | 'basladi'
  | 'iptal_edilmis'
  | 'yetkisiz'
  | 'rakip_var'
  | 'kacirildi'

export type Sonuc<T = object> = ({ ok: true } & T) | { ok: false; hata: Hata }

export type Dilim = {
  saat: number
  durum: 'bos' | 'dolu' | 'bakim' | 'gecmis' | 'rakip_ariyor'
  id?: number
  takimAdi?: string
}

export type PanelDilim = {
  saat: number
  gecmis: boolean
  durum: 'bos' | 'dolu' | 'bakim'
  id?: number
  takimAdi?: string | null
  rakipTakimAdi?: string | null
  rakipAriyor?: boolean
  not?: string | null
  olusturulma?: string
}

export type KodKaydi = {
  rol: 'ev_sahibi' | 'rakip'
  saha: Saha
  tarih: string
  saat: number
  durum: 'aktif' | 'iptal'
  iptalEden: 'takim' | 'isletmeci' | null
  takimAdi: string
  rakipTakimAdi: string | null
  rakipAriyor: boolean
  basladi: boolean
}

// Birbirine karışan karakterler (0/O, 1/I/L) yok.
const ALFABE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const hata = (h: Hata) => ({ ok: false as const, hata: h })
// Başlangıcı henüz gelmemiş dilim koşulu; $t = bugünün tarihi, $s = şu anki saat.
const gelecek = (t: number, s: number) => `(tarih > $${t}::date OR (tarih = $${t}::date AND saat > $${s}))`

export function cekirdekOlustur(pool: Pool, a: Ayarlar) {
  const kodOzeti = (kod: string) =>
    createHmac('sha256', a.ozetAnahtari)
      .update('kod:' + String(kod).toUpperCase().replace(/[^A-Z0-9]/g, ''))
      .digest('hex')
  const yeniKod = () => Array.from({ length: 8 }, () => ALFABE[randomInt(ALFABE.length)]).join('')
  const saatler = () => Array.from({ length: a.kapanis - a.acilis }, (_, i) => a.acilis + i)
  const sonGun = (bugun: string) => gunEkle(bugun, a.gunSayisi - 1)

  async function islem<T>(f: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await pool.connect()
    try {
      await c.query('BEGIN')
      const r = await f(c)
      await c.query('COMMIT')
      return r
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      c.release()
    }
  }

  function dilimDenetle(saha: unknown, tarih: unknown, saat: unknown, simdi: Date): Hata | null {
    if (typeof saha !== 'string' || !(saha in SAHALAR) || !tarihGecerli(tarih)) return 'gecersiz'
    if (typeof saat !== 'number' || !Number.isInteger(saat) || saat < a.acilis || saat >= a.kapanis) return 'gecersiz'
    const s = istanbul(simdi)
    if (tarih < s.tarih || (tarih === s.tarih && saat <= s.saat)) return 'gecmis_saat'
    if (tarih > sonGun(s.tarih)) return 'pencere_disi'
    return null
  }

  // Sayım ve ardından gelen yazma aynı işlemde, IP özeti başına kilit altında yapılır;
  // böylece aynı IP'den eşzamanlı istekler sınırı aşamaz.
  async function sinirAsildi(c: PoolClient, ipOzeti: string, s: { tarih: string; saat: number }) {
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [ipOzeti])
    const { rows } = await c.query<{ n: string }>(
      `SELECT count(*) FILTER (WHERE ip_ozeti = $1) + count(*) FILTER (WHERE rakip_ip_ozeti = $1) AS n
         FROM kayitlar
        WHERE tur = 'rezervasyon' AND durum = 'aktif' AND ${gelecek(2, 3)}
          AND (ip_ozeti = $1 OR rakip_ip_ozeti = $1)`,
      [ipOzeti, s.tarih, s.saat],
    )
    return Number(rows[0].n) >= a.ipSiniri
  }

  async function kodlaGetir(kod: string, simdi: Date): Promise<Sonuc<KodKaydi>> {
    const s = istanbul(simdi)
    const { rows } = await pool.query(
      `SELECT saha, tarih::text AS tarih, saat, durum, iptal_eden, takim_adi, rakip_takim_adi, rakip_ariyor,
              (kod_ozeti = $1) AS ev_sahibi
         FROM kayitlar WHERE kod_ozeti = $1 OR rakip_kod_ozeti = $1`,
      [kodOzeti(kod)],
    )
    const r = rows[0]
    if (!r) return hata('bulunamadi')
    return {
      ok: true,
      rol: r.ev_sahibi ? 'ev_sahibi' : 'rakip',
      saha: r.saha,
      tarih: r.tarih,
      saat: r.saat,
      durum: r.durum,
      iptalEden: r.iptal_eden,
      takimAdi: r.takim_adi,
      rakipTakimAdi: r.rakip_takim_adi,
      rakipAriyor: r.rakip_ariyor,
      basladi: r.tarih < s.tarih || (r.tarih === s.tarih && r.saat <= s.saat),
    }
  }

  // Koşullu güncelleme satır etkilemediyse nedenini bulur.
  async function neden(kod: string, rol: KodKaydi['rol'], simdi: Date, varsayilan: Hata): Promise<Sonuc> {
    const k = await kodlaGetir(kod, simdi)
    if (!k.ok) return hata('bulunamadi')
    if (k.rol !== rol) return hata('yetkisiz')
    if (k.durum === 'iptal') return hata('iptal_edilmis')
    if (k.basladi) return hata('basladi')
    return hata(varsayilan)
  }

  return {
    ayarlar: a,
    kodlaGetir,

    /** Rezervasyona açık günler, bugünden başlayarak. */
    gunler(simdi: Date): string[] {
      const { tarih } = istanbul(simdi)
      return Array.from({ length: a.gunSayisi }, (_, i) => gunEkle(tarih, i))
    },

    /** Herkese açık görünüm: dolu saatlerde takım adı verilmez, yalnız rakip arayanlarda verilir. */
    async uygunluk(tarih: unknown, simdi: Date): Promise<Sonuc<{ tarih: string; sahalar: Record<Saha, Dilim[]> }>> {
      const s = istanbul(simdi)
      if (!tarihGecerli(tarih)) return hata('gecersiz')
      if (tarih < s.tarih || tarih > sonGun(s.tarih)) return hata('pencere_disi')
      const { rows } = await pool.query(
        `SELECT id, saha, saat, tur, takim_adi, rakip_ariyor, rakip_takim_adi
           FROM kayitlar WHERE tarih = $1::date AND durum = 'aktif'`,
        [tarih],
      )
      const sahalar = {} as Record<Saha, Dilim[]>
      for (const saha of Object.keys(SAHALAR) as Saha[]) {
        sahalar[saha] = saatler().map((saat): Dilim => {
          if (tarih === s.tarih && saat <= s.saat) return { saat, durum: 'gecmis' }
          const r = rows.find((x) => x.saha === saha && x.saat === saat)
          if (!r) return { saat, durum: 'bos' }
          if (r.tur === 'bakim') return { saat, durum: 'bakim' }
          if (r.rakip_ariyor && !r.rakip_takim_adi) return { saat, durum: 'rakip_ariyor', id: r.id, takimAdi: r.takim_adi }
          return { saat, durum: 'dolu' }
        })
      }
      return { ok: true, tarih, sahalar }
    },

    /** Takım adının doğrulanmış olduğu varsayılır (koruma katmanının işi). */
    async rezervasyonOlustur(
      g: { saha: unknown; tarih: unknown; saat: unknown; takimAdi: string; rakipAriyor: boolean; ipOzeti: string },
      simdi: Date,
    ): Promise<Sonuc<{ kod: string }>> {
      const h = dilimDenetle(g.saha, g.tarih, g.saat, simdi)
      if (h) return hata(h)
      const s = istanbul(simdi)
      const kod = yeniKod()
      return islem(async (c) => {
        if (await sinirAsildi(c, g.ipOzeti, s)) return hata('sinir')
        // "Önce bak sonra yaz" yok: aynı dilime ikinci aktif kaydı tekil kısıt reddeder.
        const r = await c.query(
          `INSERT INTO kayitlar (saha, tarih, saat, tur, takim_adi, kod_ozeti, rakip_ariyor, ip_ozeti)
           VALUES ($1, $2::date, $3, 'rezervasyon', $4, $5, $6, $7)
           ON CONFLICT (saha, tarih, saat) WHERE durum = 'aktif' DO NOTHING`,
          [g.saha, g.tarih, g.saat, g.takimAdi, kodOzeti(kod), g.rakipAriyor, g.ipOzeti],
        )
        return r.rowCount ? { ok: true as const, kod } : hata('dolu')
      })
    },

    /** Ev sahibi iptali: maç tümden iptal olur, saat boşalır. */
    async iptalEt(kod: string, simdi: Date): Promise<Sonuc> {
      const s = istanbul(simdi)
      const r = await pool.query(
        `UPDATE kayitlar SET durum = 'iptal', iptal_zamani = now(), iptal_eden = 'takim'
          WHERE kod_ozeti = $1 AND durum = 'aktif' AND ${gelecek(2, 3)}`,
        [kodOzeti(kod), s.tarih, s.saat],
      )
      return r.rowCount ? { ok: true } : neden(kod, 'ev_sahibi', simdi, 'bulunamadi')
    },

    /** "Rakip arıyoruz" işareti yalnız rakip yokken açılıp kapatılabilir. */
    async rakipAramaAyarla(kod: string, acik: boolean, simdi: Date): Promise<Sonuc> {
      const s = istanbul(simdi)
      const r = await pool.query(
        `UPDATE kayitlar SET rakip_ariyor = $4
          WHERE kod_ozeti = $1 AND durum = 'aktif' AND rakip_takim_adi IS NULL AND ${gelecek(2, 3)}`,
        [kodOzeti(kod), s.tarih, s.saat, acik],
      )
      return r.rowCount ? { ok: true } : neden(kod, 'ev_sahibi', simdi, 'rakip_var')
    },

    async rakipArayanlar(simdi: Date) {
      const s = istanbul(simdi)
      const { rows } = await pool.query<{ id: number; saha: Saha; tarih: string; saat: number; takimAdi: string }>(
        `SELECT id, saha, tarih::text AS tarih, saat, takim_adi AS "takimAdi"
           FROM kayitlar
          WHERE tur = 'rezervasyon' AND durum = 'aktif' AND rakip_ariyor AND rakip_takim_adi IS NULL
            AND ${gelecek(1, 2)}
          ORDER BY tarih, saat, saha`,
        [s.tarih, s.saat],
      )
      return rows
    },

    /** İlk gelen katılır: tek koşullu güncelleme, eşzamanlı isteklerden yalnız biri satırı değiştirir. */
    async rakipKatil(g: { id: unknown; takimAdi: string; ipOzeti: string }, simdi: Date): Promise<Sonuc<{ kod: string }>> {
      if (typeof g.id !== 'number' || !Number.isSafeInteger(g.id) || g.id < 1) return hata('gecersiz')
      const s = istanbul(simdi)
      const kod = yeniKod()
      return islem(async (c) => {
        if (await sinirAsildi(c, g.ipOzeti, s)) return hata('sinir')
        const r = await c.query(
          `UPDATE kayitlar SET rakip_takim_adi = $4, rakip_kod_ozeti = $5, rakip_ip_ozeti = $6
            WHERE id = $1 AND tur = 'rezervasyon' AND durum = 'aktif' AND rakip_ariyor
              AND rakip_takim_adi IS NULL AND ${gelecek(2, 3)}`,
          [g.id, s.tarih, s.saat, g.takimAdi, kodOzeti(kod), g.ipOzeti],
        )
        return r.rowCount ? { ok: true as const, kod } : hata('kacirildi')
      })
    },

    /** Rakip ayrılınca kayıt yeniden "rakip arıyor" durumuna döner. */
    async rakipAyril(kod: string, simdi: Date): Promise<Sonuc> {
      const s = istanbul(simdi)
      const r = await pool.query(
        `UPDATE kayitlar SET rakip_takim_adi = NULL, rakip_kod_ozeti = NULL, rakip_ip_ozeti = NULL
          WHERE rakip_kod_ozeti = $1 AND durum = 'aktif' AND ${gelecek(2, 3)}`,
        [kodOzeti(kod), s.tarih, s.saat],
      )
      return r.rowCount ? { ok: true } : neden(kod, 'rakip', simdi, 'bulunamadi')
    },

    // ---- İşletmeci ----

    async gunDokumu(tarih: unknown, simdi: Date): Promise<Sonuc<{ tarih: string; sahalar: Record<Saha, PanelDilim[]> }>> {
      if (!tarihGecerli(tarih)) return hata('gecersiz')
      const s = istanbul(simdi)
      const { rows } = await pool.query(
        `SELECT id, saha, saat, tur, takim_adi, rakip_takim_adi, rakip_ariyor, bakim_notu, olusturulma
           FROM kayitlar WHERE tarih = $1::date AND durum = 'aktif'`,
        [tarih],
      )
      const sahalar = {} as Record<Saha, PanelDilim[]>
      for (const saha of Object.keys(SAHALAR) as Saha[]) {
        sahalar[saha] = saatler().map((saat): PanelDilim => {
          const gecmis = tarih < s.tarih || (tarih === s.tarih && saat <= s.saat)
          const r = rows.find((x) => x.saha === saha && x.saat === saat)
          if (!r) return { saat, gecmis, durum: 'bos' }
          if (r.tur === 'bakim') return { saat, gecmis, durum: 'bakim', id: r.id, not: r.bakim_notu }
          return {
            saat,
            gecmis,
            durum: 'dolu',
            id: r.id,
            takimAdi: r.takim_adi,
            rakipTakimAdi: r.rakip_takim_adi,
            rakipAriyor: r.rakip_ariyor,
            olusturulma: r.olusturulma.toISOString(),
          }
        })
      }
      return { ok: true, tarih, sahalar }
    },

    async isletmeciIptal(id: unknown): Promise<Sonuc> {
      if (typeof id !== 'number' || !Number.isSafeInteger(id)) return hata('gecersiz')
      const r = await pool.query(
        `UPDATE kayitlar SET durum = 'iptal', iptal_zamani = now(), iptal_eden = 'isletmeci'
          WHERE id = $1 AND tur = 'rezervasyon' AND durum = 'aktif'`,
        [id],
      )
      return r.rowCount ? { ok: true } : hata('bulunamadi')
    },

    /** Yalnız boş saat kapanır; dolu olanlar `dolu` listesinde döner ve dokunulmaz. */
    async saatKapat(
      g: { saha: unknown; tarih: unknown; saatler: unknown; not?: unknown },
      simdi: Date,
    ): Promise<Sonuc<{ kapatilan: number[]; dolu: number[] }>> {
      if (!Array.isArray(g.saatler) || g.saatler.length === 0 || g.saatler.length > 24) return hata('gecersiz')
      for (const saat of g.saatler) {
        const h = dilimDenetle(g.saha, g.tarih, saat, simdi)
        if (h) return hata(h)
      }
      const not = typeof g.not === 'string' ? g.not.trim().slice(0, 80) || null : null
      const kapatilan: number[] = []
      const dolu: number[] = []
      for (const saat of new Set(g.saatler as number[])) {
        const r = await pool.query(
          `INSERT INTO kayitlar (saha, tarih, saat, tur, bakim_notu) VALUES ($1, $2::date, $3, 'bakim', $4)
           ON CONFLICT (saha, tarih, saat) WHERE durum = 'aktif' DO NOTHING`,
          [g.saha, g.tarih, saat, not],
        )
        ;(r.rowCount ? kapatilan : dolu).push(saat)
      }
      return { ok: true, kapatilan, dolu }
    },

    async saatAc(id: unknown): Promise<Sonuc> {
      if (typeof id !== 'number' || !Number.isSafeInteger(id)) return hata('gecersiz')
      const r = await pool.query(`DELETE FROM kayitlar WHERE id = $1 AND tur = 'bakim'`, [id])
      return r.rowCount ? { ok: true } : hata('bulunamadi')
    },

    /** Maç tarihi üzerinden 7 gün geçen kayıtları (IP özetleriyle birlikte) siler. */
    async eskiKayitlariSil(simdi: Date): Promise<number> {
      const r = await pool.query('DELETE FROM kayitlar WHERE tarih < $1::date', [gunEkle(istanbul(simdi).tarih, -7)])
      return r.rowCount ?? 0
    },
  }
}

export type Cekirdek = ReturnType<typeof cekirdekOlustur>
