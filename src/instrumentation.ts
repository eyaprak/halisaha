// Sunucu açılışında bir kez çalışır: ayarları doğrular, şemayı kurar, temizliği zamanlar.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return
  const { baslat } = await import('./lib/baslat')
  await baslat()
}
