import type { Pool } from 'pg'

// Sürümlü şema göçleri. Yayınlanmış bir göç değiştirilmez; yenisi listenin sonuna eklenir.
const GOCLER: { ad: string; sql: string }[] = [
  {
    ad: '001_kayitlar',
    sql: `
      CREATE TABLE kayitlar (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        saha TEXT NOT NULL CHECK (saha IN ('acik', 'kapali')),
        tarih DATE NOT NULL,
        saat SMALLINT NOT NULL CHECK (saat BETWEEN 0 AND 23),
        tur TEXT NOT NULL CHECK (tur IN ('rezervasyon', 'bakim')),
        durum TEXT NOT NULL DEFAULT 'aktif' CHECK (durum IN ('aktif', 'iptal')),
        takim_adi TEXT,
        kod_ozeti TEXT,
        rakip_ariyor BOOLEAN NOT NULL DEFAULT false,
        rakip_takim_adi TEXT,
        rakip_kod_ozeti TEXT,
        ip_ozeti TEXT,
        rakip_ip_ozeti TEXT,
        bakim_notu TEXT,
        olusturulma TIMESTAMPTZ NOT NULL DEFAULT now(),
        iptal_zamani TIMESTAMPTZ,
        iptal_eden TEXT CHECK (iptal_eden IN ('takim', 'isletmeci'))
      );
      -- Çift rezervasyon garantisi: bir saha/gün/saat için tek aktif kayıt (rezervasyon ya da bakım).
      CREATE UNIQUE INDEX kayitlar_aktif_tekil ON kayitlar (saha, tarih, saat) WHERE durum = 'aktif';
      CREATE UNIQUE INDEX kayitlar_kod ON kayitlar (kod_ozeti) WHERE kod_ozeti IS NOT NULL;
      CREATE UNIQUE INDEX kayitlar_rakip_kod ON kayitlar (rakip_kod_ozeti) WHERE rakip_kod_ozeti IS NOT NULL;
      CREATE INDEX kayitlar_tarih ON kayitlar (tarih);
    `,
  },
]

export async function gocleriUygula(pool: Pool): Promise<void> {
  const c = await pool.connect()
  try {
    // Aynı anda açılan iki süreç göçü iki kez çalıştırmasın.
    await c.query('SELECT pg_advisory_lock(4201)')
    await c.query('CREATE TABLE IF NOT EXISTS goc_surumleri (ad TEXT PRIMARY KEY, zaman TIMESTAMPTZ NOT NULL DEFAULT now())')
    const { rows } = await c.query<{ ad: string }>('SELECT ad FROM goc_surumleri')
    const uygulanan = new Set(rows.map((r) => r.ad))
    for (const g of GOCLER) {
      if (uygulanan.has(g.ad)) continue
      await c.query('BEGIN')
      try {
        await c.query(g.sql)
        await c.query('INSERT INTO goc_surumleri (ad) VALUES ($1)', [g.ad])
        await c.query('COMMIT')
      } catch (e) {
        await c.query('ROLLBACK')
        throw e
      }
    }
  } finally {
    await c.query('SELECT pg_advisory_unlock(4201)').catch(() => {})
    c.release()
  }
}
