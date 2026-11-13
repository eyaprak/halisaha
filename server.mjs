// Next.js'i saran ince sunucu. Tek işi: her isteğin soket adresini X-Forwarded-For zincirinin
// sonuna eklemek. Next bu başlığı istemciden geldiği gibi geçirdiği için, bu olmadan
// IP sınırları başlık uydurularak aşılabilir. Zincirin nasıl okunduğu: src/lib/koruma.ts
import { createServer } from 'node:http'
import next from 'next'

const dev = process.env.NODE_ENV !== 'production'
const port = Number(process.env.PORT) || 3000
const app = next({ dev, hostname: '0.0.0.0', port })
const isle = app.getRequestHandler()
await app.prepare()

const sunucu = createServer((istek, yanit) => {
  istek.headers['x-forwarded-for'] = [istek.headers['x-forwarded-for'], istek.socket.remoteAddress]
    .flat()
    .filter(Boolean)
    .join(', ')
  isle(istek, yanit)
})
if (dev) sunucu.on('upgrade', app.getUpgradeHandler())
sunucu.listen(port, '0.0.0.0', () => console.log(`Halı saha uygulaması ${port} portunda hazır.`))

// Konteynerde PID 1 olduğumuz için sinyali kendimiz karşılıyoruz; yoksa durdurma 10 saniye bekler.
for (const sinyal of ['SIGTERM', 'SIGINT']) process.on(sinyal, () => sunucu.close(() => process.exit(0)))
