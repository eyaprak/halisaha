# Teslim Raporu: Halı Saha Rezervasyon Uygulaması

Tarih: 13 Kasım 2026 · Kaynak belge: [prd.md](prd.md)

## Sonuç

prd.md'deki 15 kabul kriterinin 15'i **geçti**. Uygulama `docker compose up -d --build` ile http://localhost:3000 adresinde açılıyor, 33 birim testinin tamamı geçiyor.

| # | Kriter (özet) | Durum | Kanıtın özü |
|---|---|---|---|
| 1 | Tek komutla ayağa kalkar, sağlık ucu 200, elle SQL yok | **geçti** | Volume silinip `up -d --build` sonrası 2. saniyede `HTTP 200`; tablolar kendiliğinden kuruldu |
| 2 | Konteynerler yeniden oluşturulunca veri durur | **geçti** | `down` + `up` sonrası yeni konteyner kimlikleri, aynı kod aynı rezervasyonu döndürdü |
| 3 | Uçtan uca akış: seç, kod al, gör, iptal et, saat boşalır | **geçti** | HTTP üzerinden 6 kontrol + tarayıcıda aynı akış |
| 4 | Aynı saate 50 eşzamanlı istekten tam 1'i başarılı | **geçti** | `1 başarılı, 49 "dolu" (409)`; veritabanında `count = 1` |
| 5 | Rakip akışı; 20 eşzamanlı katılımdan tam 1'i başarılı | **geçti** | `1 başarılı, 19 "kaçırıldı" (409)` |
| 6 | Aynı IP'den 4. aktif rezervasyon reddedilir | **geçti** | `200 200 200 403 (sinir)`; iptal sonrası `200` |
| 7 | Dakikada 10'dan fazla yazma ya da kod sorgusu 429 | **geçti** | 11. ve 12. istek `429`, `Retry-After: 60` |
| 8 | Uygunsuz takım adı reddedilir, HTML işlenmez | **geçti** | 11 uygunsuz ad `HTTP 400`; tarayıcıda `Tom &amp; Jerry's` metin olarak basıldı |
| 9 | Panel oturumsuz veri vermez; 5 yanlış denemede kilit | **geçti** | `401 401 401 401`; `401 401 401 401 401 429` |
| 10 | İşletmeci görür, iptal eder, kapatır, açar | **geçti** | 6 HTTP kontrolü + tarayıcıda panel akışı |
| 11 | Düz IP ve düz kod saklanmaz, kişisel veri istenmez | **geçti** | Tüm satırlar tarandı; yalnız 64 haneli HMAC özetleri var |
| 12 | Gizli değerler eksikken başlamaz, nedenini loglar | **geçti** | `BAŞLATILAMADI: Ayar hatası: …`, çıkış kodu 1 |
| 13 | 360 pikselde yatay kaydırma yok, hedefler ≥ 44 piksel | **geçti** | 6 ekran × 2 genişlik: içerik = pencere, en küçük hedef 44px |
| 14 | Çekirdek testleri geçer; build, tip, lint hatasız | **geçti** | `33 passed`, lint 0, tip 0, build çıkış 0 |
| 15 | PostgreSQL portuna ağ dışından erişilemez | **geçti** | `{"5432/tcp":null}`, hosttan `ECONNREFUSED`, başka ağdan `no response` |

Ayrıntılı kanıt aşağıda, kriter kriter. Bütün çıktılar bu makinede, teslim edilen son derlemeyle alındı.

## Çalıştırma

```bash
cp .env.example .env        # dört gizli değeri doldurun (openssl rand -hex 32)
docker compose up -d --build
# http://localhost:3000        takım ekranları
# http://localhost:3000/panel  işletmeci paneli, şifre: .env içindeki PANEL_SIFRESI
```

Bu klasörde rastgele değerlerle doldurulmuş bir `.env` hazır duruyor ve uygulama şu an çalışıyor. `.env` dosyası `.gitignore` içindedir.

Testler ve doğrulama betikleri:

```bash
docker compose -f docker-compose.test.yml up -d --wait   # atılabilir test veritabanı
npm test                                                  # 33 çekirdek testi
npm run lint && npm run typecheck && npm run build

node scripts/vekilsiz.mjs                                 # vekilsiz kurulumda sınırlar
GUVENILIR_VEKIL_SAYISI=1 docker compose up -d --wait
node --env-file=.env scripts/kabul.mjs                    # kriter 3-11, 61 kontrol
docker compose up -d --wait                               # vekil sayısını 0'a geri alır
npm i --no-save playwright-core
node --env-file=.env scripts/arayuz.mjs teslim-ekran      # tarayıcıda 375 ve 360 piksel
```

## Kanıtlar

### Yöntem hakkında bir not

Sınırlar IP başına işlediği için tek makineden "50 ayrı izleyici" sınamak ancak bir ters vekilin yaptığını taklit ederek mümkün. [scripts/kabul.mjs](scripts/kabul.mjs) bu yüzden uygulama `GUVENILIR_VEKIL_SAYISI=1` iken çalıştırıldı ve her sanal izleyici için ayrı `X-Forwarded-For` adresi gönderdi. Bu, VPS'te ters vekil arkasındaki gerçek yapılandırmanın aynısıdır.

Aynı başlığın vekilsiz kurulumda işe **yaramadığı** ayrıca [scripts/vekilsiz.mjs](scripts/vekilsiz.mjs) ile gösterildi (kriter 6 ve 7'nin ikinci kanıtı).

Aşağıdaki çıktı blokları okunabilirlik için yer yer kısaltıldı (uzun satırlar kesildi, benzer satırlar birleştirildi, `←` ile başlayan açıklamalar eklendi). Tam çıktı, "Çalıştırma" bölümündeki komutlarla yeniden alınabilir.

### K1. Tek komutla ayağa kalkar

Volume dahil her şey silindi, ardından tek komut çalıştırıldı:

```text
$ docker compose down -v
 Volume hali-saha_pgdata Removed
$ docker compose up -d --build
 Container hali-saha-db-1 Healthy
 Container hali-saha-app-1 Started
saglik: HTTP 200 (2. saniyede)        ← GET /api/saglik → {"ok":true}
ana sayfa: HTTP 200
SERVICE   IMAGE                STATUS                   PORTS
app       hali-saha-app        Up (healthy)             127.0.0.1:3000->3000/tcp
db        postgres:17-alpine   Up (healthy)             5432/tcp
tablolar: goc_surumleri, kayitlar     ← hiçbir SQL elle çalıştırılmadı
goc: 001_kayitlar
app-1  | Ayarlar doğrulandı, veritabanı şeması güncel.
```

Sınır: "temiz makine" bu makinede volume ve konteynerler silinerek sınandı; imaj katmanları önbellekteydi. Başka bir makinede ilk derleme, bağımlılıkları indirdiği için birkaç dakika sürer.

### K2. Veri konteyner yeniden oluşturulunca kaybolmaz

```text
1) rezervasyon alindi: {"ok":true,"kod":"SB******"}
2) konteynerler (once): f201ecc5f412 2119a043ace8
 Container hali-saha-app-1 Removed
 Container hali-saha-db-1 Removed
3) volume duruyor: hali-saha_pgdata
4) konteynerler (sonra): 2690741759d3 7a898d8c06ba       ← ikisi de yeni
5) ayni kodla sorgu: {"ok":true,"rol":"ev_sahibi","saha":"kapali","tarih":"2026-11-15",
   "saat":21,"durum":"aktif","takimAdi":"Kalici Veri SK", …}
6) restart sonrasi: {"ok":true,"rol":"ev_sahibi","saha":"kapali", …}
```

### K3. Uçtan uca akış

```text
GEÇTİ  [K3] boş saat seçilip takım adıyla rezervasyon alınır, kod döner  →  HTTP 200, kod 8 karakter
GEÇTİ  [K3] saat artık dolu görünür ve takım adı herkese açık listede yoktur  →  {"saat":9,"durum":"dolu"}
GEÇTİ  [K3] kodla rezervasyon görüntülenir  →  2026-11-19 9:00 acik aktif
GEÇTİ  [K3] yanlış kod yalnız "bulunamadı" döner  →  HTTP 404 bulunamadi
GEÇTİ  [K3] kodla iptal edilir, saat yeniden boş görünür  →  HTTP 200, dilim: bos
GEÇTİ  [K3] iptal sonrası kod iptali gösterir  →  iptal / takim
```

Aynı akış tarayıcıda da yürütüldü (aşağıda "375 pikselde deneme").

### K4. 50 eşzamanlı istek, tek kazanan

```text
GEÇTİ  [K4] aynı dilime 50 eşzamanlı istekten tam 1 tanesi başarılı  →  1 başarılı, 49 "dolu" (409)
GEÇTİ  [K4] veritabanında o dilim için tek aktif kayıt var  →  count = 1
```

Garanti uygulama kodunda değil veritabanındadır: `kayitlar (saha, tarih, saat) WHERE durum = 'aktif'` üzerinde tekil kısıt. Aynı senaryo çekirdek testinde de var.

### K5. Rakip akışı

```text
GEÇTİ  [K5] "rakip arıyoruz" işaretli maç listede takım adıyla görünür
GEÇTİ  [K5] ikinci takım katılır ve kendi kodunu alır  →  HTTP 200
GEÇTİ  [K5] maç listeden düşer
GEÇTİ  [K5] ev sahibi koduyla rakibinin adını görür  →  Deplasman SK
GEÇTİ  [K5] rakip ayrılınca maç listeye döner  →  HTTP 200
GEÇTİ  [K5] aynı maça 20 eşzamanlı katılımdan tam 1 tanesi başarılı  →  1 başarılı, 19 "kaçırıldı" (409)
GEÇTİ  [K5] ev sahibi iptal edince rakibin kodu iptali gösterir  →  iptal / takim
```

### K6. IP başına 3 aktif rezervasyon

Vekilli kurulumda (kabul.mjs):

```text
GEÇTİ  [K6] aynı IP ilk 3 rezervasyonu alır, 4. reddedilir  →  4. istek: HTTP 403 "Rezervasyon sınırına ulaştın. Birini iptal edince yenisini alabilirsin."
GEÇTİ  [K6] aynı saati başka bir IP alabilir (sınır IP başınadır)  →  HTTP 200
GEÇTİ  [K6] biri iptal edilince yenisi alınabilir  →  HTTP 200
```

Vekilsiz kurulumda, her istekte farklı sahte `X-Forwarded-For` ile (vekilsiz.mjs):

```text
GEÇTİ  her istekte farklı sahte X-Forwarded-For gönderilse de 4. rezervasyon reddedilir  →  200 200 200 403 (sinir)
GEÇTİ  biri iptal edilince yenisi alınabilir  →  iptaller: 200 200 200, yeni rezervasyon: 200
```

### K7. Hız limiti

```text
GEÇTİ  [K7] dakikada 10 yazma isteğinden sonrası 429 döner  →  400 400 400 400 400 400 400 400 400 400 429 429
GEÇTİ  [K7] dakikada 10 kod sorgusundan sonrası 429 döner (kod tahmini sınırlı)  →  404 404 404 404 404 404 404 404 404 404 429 429
GEÇTİ  [K7] 429 yanıtı anlaşılır mesaj ve Retry-After taşır  →  "Çok hızlı gidiyorsun. Bir dakika sonra yeniden dene." Retry-After: 60
GEÇTİ  [K7] sınır IP başınadır: başka IP etkilenmez  →  HTTP 404
```

Vekilsiz kurulumda sahte başlıkla:

```text
GEÇTİ  dakikada 10 yazmadan sonrası, sahte adreslere rağmen 429 döner  →  9-12. istekler: 200 400 429 429
```

### K8. Takım adı kuralları

```text
GEÇTİ  [K8] reddedilir: küfür ("Siktir FC")  →  HTTP 400 "Bu takım adı uygun değil. Başka bir ad dene."
GEÇTİ  [K8] reddedilir: boşluklu küfür ("o r o s p u lar")  →  HTTP 400
GEÇTİ  [K8] reddedilir: rakamla küfür ("S1kt1r Spor")  →  HTTP 400
GEÇTİ  [K8] reddedilir: bağlantı ("www.bahis.com")  →  HTTP 400 "Takım adında bağlantı olamaz."
GEÇTİ  [K8] reddedilir: bağlantı 2 ("bedava.site")  →  HTTP 400
GEÇTİ  [K8] reddedilir: tek karakter ("A")  →  HTTP 400 "Takım adı 2 ile 24 karakter arasında olmalı."
GEÇTİ  [K8] reddedilir: 25 karakter  →  HTTP 400
GEÇTİ  [K8] reddedilir: HTML ("<script>alert(1)</script>")  →  HTTP 400
GEÇTİ  [K8] reddedilir: HTML 2 ("<img src=x onerror=1>")  →  HTTP 400 "Takım adında yalnız harf, rakam, boşluk ve . , ' & ! + - kullanılabilir."
GEÇTİ  [K8] reddedilir: yalnız boşluk  →  HTTP 400
GEÇTİ  [K8] reddedilir: sayı (metin değil) (12345)  →  HTTP 400 "Takım adı gerekli."
GEÇTİ  [K8] rakip katılımında da ad doğrulanır  →  HTTP 400
GEÇTİ  [K8] reddedilen adlarla saat alınmamıştır
GEÇTİ  [K8] kabul edilir: Çılgın Şimşekler / Tom & Jerry's 07 / Klasik Götürenler / Nazilli Gücü  →  HTTP 200
GEÇTİ  [K8] veritabanında < ya da > içeren takım adı yok (HTML saklanamaz)  →  count = 0
GEÇTİ  [K8] aşırı büyük istek gövdesi reddedilir  →  HTTP 413
```

"Hiçbir ekranda işlenmiş biçimde görünmez" iki katmanla sağlanıyor: `<` ve `>` hiç kabul edilmiyor, kabul edilen özel karakterler de kaçışlı basılıyor. Tarayıcı kanıtı:

```text
GEÇTİ  özel karakterli takım adı metin olarak basılır (HTML işlenmez)   ← innerHTML === "Tom &amp; Jerry's"
```

### K9. Panel yetkisi

```text
GEÇTİ  [K9] panel uçları oturumsuz istekte 401 döner ve veri vermez  →  401 401 401 401
GEÇTİ  [K9] uydurma oturum çerezi kabul edilmez  →  HTTP 401
GEÇTİ  [K9] panel sayfası oturumsuz açılınca yalnız giriş formunu verir
GEÇTİ  [K9] 5 yanlış şifreden sonra giriş geçici olarak reddedilir  →  401 401 401 401 401 429
GEÇTİ  [K9] kilitliyken doğru şifre de reddedilir (deneme yanılma işe yaramaz)  →  HTTP 429 "Çok fazla yanlış deneme. 15 dakika sonra yeniden dene."
GEÇTİ  [K9] doğru şifreyle giriş yapılır; çerez HttpOnly, Secure, SameSite=Strict ve 12 saatlik  →  panel_oturumu=…; Path=/; Max-Age=43200; Secure; HttpOnly; SameSite=strict
GEÇTİ  [K9] oturumla gün dökümü alınır  →  HTTP 200
GEÇTİ  [K9] başka siteden gelen (Origin uyuşmayan) istek reddedilir  →  HTTP 403
```

### K10. İşletmeci işlemleri

```text
GEÇTİ  [K10] işletmeci seçtiği günün iki sahasını takım adlarıyla görür  →  açık 15 dilim, kapalı 15 dilim; 23:00 → Panel Sinamasi
GEÇTİ  [K10] işletmeci rezervasyonu iptal eder; takımın kodu "işletmeci iptal etti" gösterir  →  iptal / isletmeci
GEÇTİ  [K10] işletmeci saati notla kapatır  →  {"ok":true,"kapatilan":[23],"dolu":[]}
GEÇTİ  [K10] kapalı saati takım alamaz, listede "bakımda" görünür  →  HTTP 409, dilim: bakim
GEÇTİ  [K10] dolu saat kapatılamaz, rezervasyon yerinde kalır  →  {"ok":true,"kapatilan":[],"dolu":[9]}
GEÇTİ  [K10] işletmeci saati yeniden açar, saat alınabilir  →  aç: HTTP 200, rezervasyon: HTTP 200
GEÇTİ  [K10] çıkış oturum çerezini siler  →  panel_oturumu=; Path=/; Max-Age=0
```

### K11. Kişisel veri yok

```text
GEÇTİ  [K11] veritabanında düz rezervasyon kodu yok  →  kod tüm satırlarda arandı (20 satır)
GEÇTİ  [K11] veritabanında düz IP adresi yok  →  istemci IP'leri tüm satırlarda arandı
GEÇTİ  [K11] kod ve IP yalnız 64 haneli HMAC özeti olarak saklanır  →  b1eda76092… | 5b56575b9f…
GEÇTİ  [K11] şemada ad, telefon ya da e-posta sütunu yok  →  id, saha, tarih, saat, tur, durum, takim_adi, kod_ozeti,
       rakip_ariyor, rakip_takim_adi, rakip_kod_ozeti, ip_ozeti, rakip_ip_ozeti, bakim_notu, olusturulma, iptal_zamani, iptal_eden
GEÇTİ  [K11] takım ekranlarında telefon ya da e-posta giriş alanı yok
```

Takım ekranlarındaki tek metin alanları takım adı ve rezervasyon kodudur (ekran görüntüleri: [02](teslim-ekran/02-rezervasyon-formu.png), [06](teslim-ekran/06-rezervasyonum.png)).

### K12. Eksik gizli değerle başlamaz

```text
$ docker compose run --rm -e PANEL_SIFRESI= -e OTURUM_ANAHTARI=kisa -e IP_OZET_ANAHTARI= app
BAŞLATILAMADI: Ayar hatası: PANEL_SIFRESI tanımlı değil; OTURUM_ANAHTARI çok kısa (en az 32 karakter); IP_OZET_ANAHTARI tanımlı değil
cikis kodu: 1
```

Süreç port dinlemeye başlamadan, yaklaşık 2 saniyede kendiliğinden çıktı.

### K13. Telefon genişliği

[scripts/arayuz.mjs](scripts/arayuz.mjs), Microsoft Edge'i telefon öykünmesiyle (dokunmatik, 2x yoğunluk) açıp her ekranda `scrollWidth` değerini ve görünen bütün bağlantı, düğme ve giriş alanlarının yüksekliğini ölçtü. Onay kutularında ölçülen alan, kutuyu saran etikettir.

```text
GEÇTİ  360px · saatler: içerik 360px / pencere 360px; 29 hedef, en küçüğü 44px ("İşletmeci girişi")
GEÇTİ  360px · rezervasyon çekmecesi: içerik 360px / pencere 360px; 33 hedef, en küçüğü 44px
GEÇTİ  360px · rakip bul: içerik 360px / pencere 360px; 9 hedef, en küçüğü 44px
GEÇTİ  360px · rezervasyonum: içerik 360px / pencere 360px; 7 hedef, en küçüğü 44px
GEÇTİ  360px · panel girişi: içerik 360px / pencere 360px; 7 hedef, en küçüğü 44px
GEÇTİ  360px · panel (saat seçili): içerik 360px / pencere 360px; 42 hedef, en küçüğü 44px ("ÇIKIŞ")
GEÇTİ  375px · (aynı 6 ekran): içerik 375px / pencere 375px; en küçük hedef 44px
```

Kriter takım ekranlarını istiyor; panel de ölçüldü ve geçti. Sınır: ölçüm Chromium tabanlı bir tarayıcının telefon öykünmesinde yapıldı; fiziksel bir telefonda ya da Safari'de denenmedi.

### K14. Testler, build, tip, lint

```text
$ npm run lint        →  0 hata, 0 uyarı
$ npm run typecheck   →  0 hata
$ npm test
 Test Files  1 passed (1)
      Tests  33 passed (33)
$ npm run build
 ✓ Compiled successfully
 Route (app):  ○ /   ○ /kod   ○ /rakip   ƒ /panel   ƒ /api/[...yol]
 build çıkış kodu: 0   (uyarı yok)
```

33 testin başlıkları "Otomatik testler" bölümünde.

### K15. PostgreSQL dışarı kapalı

```text
a) yayinlanan portlar (db): {"5432/tcp":null}
b) docker compose port db 5432: invalid IP:0                       ← eşleme yok
c) hosttan localhost:5432: erisilemiyor (ECONNREFUSED)
d) ag disindaki bir konteynerden 172.22.0.2:5432: no response
e) ic agdan (app konteyneri) db:5432: erisilebiliyor
```

## 375 pikselde deneme

Uygulama 375 × 760 piksel telefon görünümünde açıldı ve bütün akış dokunarak yürütüldü. 17 akış kontrolünün tamamı geçti:

```text
GEÇTİ  saatler ekranı 7 gün ve iki saha gösterir
GEÇTİ  rezervasyon sonrası 8 karakterlik kod gösterilir
GEÇTİ  kod ekranı Esc ile yanlışlıkla kapanmaz
GEÇTİ  kod tek dokunuşla panoya kopyalanır
GEÇTİ  alınan saat listede "rakip arıyor" olarak takım adıyla görünür
GEÇTİ  rakip katılınca kendi kodunu alır
GEÇTİ  eşleşen maç rakip listesinden düşer
GEÇTİ  kodla rezervasyon ve rakip takım görünür
GEÇTİ  özel karakterli takım adı metin olarak basılır (HTML işlenmez)
GEÇTİ  iptalden önce onay sorulur
GEÇTİ  rakip, kendi koduyla ev sahibinin iptalini görür
GEÇTİ  yanlış kodda yalnız "bulunamadı" mesajı çıkar
GEÇTİ  panel iki sahayı ayrı ayrı listeler
GEÇTİ  seçilen iki saat notla bakıma kapatılır
GEÇTİ  sayfa yenilenince oturum sürer (çerez tarayıcıda kabul edildi)
GEÇTİ  kapatılan saatler yeniden açılır
GEÇTİ  çıkış yapınca giriş ekranına dönülür
```

Ekran görüntüleri [teslim-ekran/](teslim-ekran/) klasöründe: [saatler](teslim-ekran/01-saatler.png), [rezervasyon formu](teslim-ekran/02-rezervasyon-formu.png), [kod ekranı](teslim-ekran/03-kod-ekrani.png), [rakip arayan saat](teslim-ekran/04-saat-rakip-ariyor.png), [rakip listesi](teslim-ekran/05-rakip-listesi.png), [rezervasyonum](teslim-ekran/06-rezervasyonum.png), [iptal onayı](teslim-ekran/08-iptal-onayi-kaydirilmis.png), [iptal edildi](teslim-ekran/09-iptal-edildi.png), [panel](teslim-ekran/12-panel-gun.png), [bakım](teslim-ekran/14-panel-bakim.png).

Görüntülere bakarak düzelttiklerim:

- Dokunulan öğede tarayıcının mavi vurgu kutusu çıkıyordu; kaldırılıp yerine kendi basılı durumu kondu.
- İptal onayı düğmeleri sabit alt gezintinin arkasında kalıyordu; onay açılınca görünür alana kaydırılıyor.
- "Evet, iptal et" 375 pikselde iki satıra bölünüyordu; etiket "İptal et" yapıldı.
- "Rakip arıyoruz" açıklamasının satır aralığı ve üst banttaki yarım kalan nokta düzeltildi.

## Otomatik testler

PRD kararı gereği yalnız rezervasyon çekirdeği için yazıldı; gerçek PostgreSQL 17'ye karşı çalışır, veritabanı taklit edilmez.

- **uygunluk (5):** 15 boş dilim; bugünün geçmiş dilimleri; dolu saatte takım adı yok, rakip arayanda var, bakım ayrı; pencere dışı ve bozuk tarih; gün listesi.
- **rezervasyon (8):** kod ve kodla bilgi; küçük harfli ya da boşluklu kod; dolu dilim; **50 eşzamanlı istekten tam biri**; geçmiş, pencere dışı, geçersiz dilim; IP başına 3 sınırı; **sınır eşzamanlı isteklerde de aşılmaz**; oynanmış maç sınıra sayılmaz.
- **iptal (3):** saat boşalır ve yeniden alınır; başlamış maç iptal edilemez; yanlış kod.
- **rakip bulma (10):** ilan aç, kapat; katılım ve karşılıklı görünürlük; **20 eşzamanlı katılımdan tam biri**; ayrılınca ilan döner; ev sahibi iptali rakibe yansır; rakip varken ilan değişmez; uygun olmayan maça katılım; başlamış maç; kodlar rol dışı kullanılamaz; katılım IP sınırına sayılır.
- **işletmeci (6):** kapat ve aç; dolu saat kapatılamaz; geçmiş saat kapatılamaz; iptal iki takımın kodunda görünür; iptal ve açma birbirinin kaydına dokunmaz; gün dökümü.
- **eski kayıt temizliği (1):** maçtan 7 gün sonra silinir, öncesinde dokunulmaz.

Koruma katmanı ve panel kimlik doğrulama için birim testi yok (PRD kararı); ikisi de kabul betiğiyle HTTP üzerinden doğrulandı.

## Varsayımlar

PRD'nin "Notlar" bölümündeki varsayımlar aynen uygulandı. Uygulama sırasında ek olarak şunlara ben karar verdim:

1. **Kendi sunucu sarmalayıcısı.** Next.js, istemcinin gönderdiği `X-Forwarded-For` başlığını olduğu gibi geçiriyor ve soket adresini uygulama koduna vermiyor. Vekilsiz kurulumda IP sınırının uydurma başlıkla aşılmaması için [server.mjs](server.mjs) her isteğin soket adresini zincirin sonuna ekliyor. Bedeli: Next'in "standalone" çıktısı kullanılamadığı için imaj 702 MB.
2. **IPv6'da sınır /64 bloğu başınadır.** Tek abone bloğun tamamını kullanabildiği için adres başına sınır anlamsız olurdu.
3. **Rezervasyon kodu özeti `IP_OZET_ANAHTARI` ile alınır** (ayrı bir anahtar eklenmedi). Bu anahtar değişirse mevcut kodlar geçersiz olur.
4. **Gizli değer alt sınırları:** panel şifresi en az 10, iki anahtar en az 32 karakter.
5. **Takım adında yalnız Latin harfleri** (Türkçe dahil), rakam, boşluk ve `. , ' & ! + -`. Başka alfabelerdeki benzer harflerle küfür filtresi atlatılamasın diye.
6. **Başlamış saat alınamaz.** 20:00 dilimi saat 20:00'de "geçti" olur; maç sürerken de rezerve edilemez.
7. **Herkese açık okuma uçlarında** (saat listesi, rakip arayanlar) hız limiti yok. Aynı IP'yi paylaşan izleyiciler 20 saniyelik yenilemelerle birbirini kilitlemesin diye. PRD yalnız yazma, kod sorgusu ve giriş için limit istiyor.
8. **Giriş kilidi yalnız yanlış denemeleri sayar;** kilitliyken doğru şifre de reddedilir.
9. **İşletmeci** yalnız rezervasyon penceresindeki, başlamamış saatleri kapatabilir; geçmiş günleri görüntüleyebilir ama değiştiremez.
10. **Bakım açılınca kayıt silinir;** kapatma geçmişi tutulmaz.
11. **Rakip ayrılınca kodu geçersiz olur.** Rakip koduyla maç iptal edilemez, yalnız ayrılınır.
12. **Kod yalnız oluşturma anında gösterilir** ve o ekran Esc ya da dışarı dokunmayla kapanmaz; "Kaydettim, kapat" gerekir.
13. **Çıkış yalnız çerezi siler** (oturum durumsuz). Çalınmış bir çerez 12 saatlik süresi dolana kadar geçerlidir.
14. **Origin başlığı olmayan POST kabul edilir.** Tarayıcılar POST'ta bu başlığı gönderir; göndermeyen istemci çerez taşımadığı için CSRF riski yoktur.
15. **Uygulama portu varsayılan olarak yalnız `127.0.0.1`'e bağlanır** (`YAYIN_ADRESI`). Böylece VPS'te ters vekili atlayıp uygulamaya doğrudan ulaşılamaz.
16. **Şema göçleri kod içinde** sürümlü SQL listesi olarak durur; ayrı göç aracı yok.
17. **İstek gövdesi sınırı 4 KB.**
18. **Görsel kimlik:** gece maçı teması (koyu çim, tebeşir beyazı, projektör sarısı), Barlow Condensed + Familjen Grotesk. Uygulama adı "Halı Saha". Arayüz "sen" diliyle yazıldı.
19. **Sürümler:** Next.js 16.4.6, React 19.3, TypeScript 6.0, PostgreSQL 17, Node 24.

## Bilinen sınırlar ve riskler

- **Docker derlemesi bu makinede ağ hatasına takıldı.** `npm ci` adımı en az iki derlemede `ERR_SSL_CIPHER_OPERATION_FAILED` ile düştü; aynı komut yeniden çalıştırılınca geçti. Hata bu makinenin Docker ağına özgü görünüyor, proje kodundan kaynaklanmıyor. Videoda canlı derleme yapılacaksa önceden bir kez derleyip önbelleği ısıtmak iyi olur.
- **Derleme internet ister:** npm paketleri ve Google Fonts dosyaları derleme sırasında indirilir.
- **Panel girişi HTTPS ya da `localhost` gerektirir.** Oturum çerezi `Secure` işaretlidir; VPS'e alan adı ve sertifika bağlanmadan, düz `http://IP:3000` üzerinden panele girilemez. Takım ekranları etkilenmez.
- **`GUVENILIR_VEKIL_SAYISI` VPS'te doğru ayarlanmalı.** Tek ters vekil arkasında `1` olmalı ve vekil `X-Forwarded-For` başlığını iletmeli. Değer `0` kalırsa bütün izleyiciler tek IP sayılır ve 3 rezervasyonluk sınıra birlikte takılır; fazla yazılırsa sınır başlık uydurularak aşılır.
- **Hız limiti sayaçları bellekte.** Yeniden başlatmada sıfırlanır ve tek uygulama kopyası varsayar.
- **Küfür filtresi küçük bir gömülü listedir.** Her varyasyonu yakalamaz ve nadiren masum bir adı reddeder (örneğin tek başına "Sık" kelimesi ya da "oynayarak"). Kaçanlar için işletmeci iptali son savunmadır.
- **Kapasite:** 210 dilim kalabalık bir yayında dakikalar içinde dolabilir. `GUN_SAYISI` ve `IP_SINIRI` `.env` üzerinden ayarlanır.
- **Geliştirme bağımlılıklarında 7 orta seviye `npm audit` uyarısı** var (lint araç zinciri, `typescript-eslint`). Çalışan imaja girmezler; üretim bağımlılıklarında `npm audit --omit=dev` 0 açık bildiriyor.
- **Otomatik veritabanı yedeği yok** (PRD'de kapsam dışı). Veri `hali-saha_pgdata` volume'undadır; `docker compose down -v` onu siler.

## Teslim durumu

- Uygulama şu an http://localhost:3000 adresinde çalışıyor. Sınama verileri silindi, veritabanı boş.
- `.env` içinde `GUVENILIR_VEKIL_SAYISI=0` (yerel, vekilsiz kullanım).
- Git'e hiçbir şey işlenmedi; bütün dosyalar çalışma klasöründe duruyor.
