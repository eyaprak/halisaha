const bicim = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
})

/** Verilen anın İstanbul'daki takvim günü (YYYY-AA-GG) ve saati (0-23). */
export function istanbul(simdi: Date): { tarih: string; saat: number } {
  const p = Object.fromEntries(bicim.formatToParts(simdi).map((x) => [x.type, x.value]))
  return { tarih: `${p.year}-${p.month}-${p.day}`, saat: Number(p.hour) }
}

export function gunEkle(tarih: string, gun: number): string {
  const d = new Date(`${tarih}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + gun)
  return d.toISOString().slice(0, 10)
}

export function tarihGecerli(t: unknown): t is string {
  if (typeof t !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return false
  const d = new Date(`${t}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t
}
