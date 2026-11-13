# Halı Saha Rezervasyon Uygulaması PRD

## Problem

Mahalledeki halı sahanın biri açık biri kapalı iki sahası var. Rezervasyonlar telefonla ve WhatsApp'tan alınıp bir deftere yazılıyor. Bu düzen üç soruna yol açıyor:

- Aynı saat yanlışlıkla iki takıma verilebiliyor.
- İptal eden takım haber vermiyor, saat boş kalıyor.
- İşletmeci hangi saatin dolu olduğunu ancak defteri açınca görüyor.

Takım tarafında da durum zor: boş saati öğrenmek için aramak ya da yazıp cevap beklemek gerekiyor, rakip arayan takımın bunu duyuracağı bir yer yok.

Ek kısıt: uygulama bir YouTube videosunda herkese açık yayınlanacak ve izleyiciler aynı anda girip deneyecek. Bu yüzden kişisel veri istememeli, tanımadığı kalabalığın kötüye kullanımına dayanmalı.

## Çözüm

Telefondan rahat kullanılan, üyeliksiz bir web uygulaması.

Takım, bugün dahil 7 günün saatlerini iki saha için görür, boş bir saati seçer, takım adını yazar ve bir rezervasyon kodu alır. Kod, rezervasyonun anahtarıdır: kodu bilen rezervasyonu görür ve başlangıç saatine kadar iptal eder. Aynı saat iki takıma verilemez; bunu veritabanı garanti eder.

Rakip arayan takım rezervasyonunu "rakip arıyoruz" diye işaretler. Bu maçlar herkese açık listede görünür, başka bir takım adını yazarak anında rakip olur ve kendi kodunu alır.

İşletmeci şifreli bir panelden seçtiği günün iki sahadaki doluluğunu görür, rezervasyon iptal eder, bakım için saat kapatır ve açar.

Bütün veri PostgreSQL'de durur. Uygulama ve PostgreSQL, Docker Compose ile tek komutla birlikte ayağa kalkar; veri bir volume'da saklanır ve konteyner yeniden başlayınca kaybolmaz.

## Kullanıcı Hikayeleri

### Takım: boş saat bulma ve rezervasyon

1. Bir takım kaptanı olarak, bugün dahil 7 günün saatlerini telefonumdan görmek istiyorum, böylece kimseyi aramadan uygun saati bulabilirim.
2. Bir takım kaptanı olarak, açık ve kapalı sahayı ayrı ayrı görmek istiyorum, böylece havaya göre saha seçebilirim.
3. Bir takım kaptanı olarak, her saatin boş, dolu ya da bakımda olduğunu tek bakışta ayırt etmek istiyorum, böylece dolu saate boşuna tıklamam.
4. Bir takım kaptanı olarak, bugünün geçmiş saatlerinin seçilemez olmasını istiyorum, böylece yanlışlıkla geçmiş bir saati almam.
5. Bir takım kaptanı olarak, boş bir saati seçip yalnız takım adımı yazarak rezervasyon yapmak istiyorum, böylece üyelik, telefon ya da e-posta vermeden işimi bitiririm.
6. Bir takım kaptanı olarak, rezervasyondan hemen sonra bir kod almak istiyorum, böylece rezervasyonumu sonradan yönetebilirim.
7. Bir takım kaptanı olarak, kodu tek dokunuşla kopyalamak istiyorum, böylece takım grubuna kolayca gönderebilirim.
8. Bir takım kaptanı olarak, kodun yalnız bir kez gösterildiğini açıkça görmek istiyorum, böylece kaydetmeyi unutmam.
9. Bir takım kaptanı olarak, seçtiğim saat ben formu doldururken başkası tarafından alındıysa net bir mesaj görmek istiyorum, böylece başka bir saat seçebilirim.
10. Bir takım kaptanı olarak, saat listesinin kendiliğinden güncellenmesini istiyorum, böylece eski bilgiye bakarak karar vermem.
11. Bir takım kaptanı olarak, takım adım kurallara uymuyorsa nedenini görmek istiyorum, böylece düzeltip devam edebilirim.
12. Bir takım kaptanı olarak, rezervasyon sınırına ulaştıysam bunu açık bir mesajla öğrenmek istiyorum, böylece neden alamadığımı anlarım.

### Takım: kodla görüntüleme ve iptal

13. Bir takım kaptanı olarak, kodumu girip rezervasyonumun sahasını, gününü, saatini ve durumunu görmek istiyorum, böylece maç bilgisinden emin olurum.
14. Bir takım kaptanı olarak, maç başlamadan rezervasyonumu kodla iptal etmek istiyorum, böylece gelemeyeceğimizde saat başkasına açılır.
15. Bir takım kaptanı olarak, iptalden önce bir onay adımı görmek istiyorum, böylece yanlışlıkla iptal etmem.
16. Bir takım kaptanı olarak, işletmeci rezervasyonumu iptal ettiyse kodla baktığımda bunu görmek istiyorum, böylece sahaya boşuna gitmem.
17. Bir takım kaptanı olarak, yanlış kod girdiğimde yalnız "bulunamadı" mesajı görmek istiyorum, böylece ne olduğunu anlarım ve başkasının kodu hakkında bilgi sızmaz.
18. Bir takım kaptanı olarak, kodumu kaybedersem işletmeciden iptal isteyebileceğimi bilmek istiyorum, böylece çaresiz kalmam.

### Takım: rakip bulma

19. Bir takım kaptanı olarak, rezervasyon yaparken "rakip arıyoruz" diye işaretlemek istiyorum, böylece rakibimiz yoksa duyurabilirim.
20. Bir takım kaptanı olarak, bu işareti sonradan kodumla açıp kapatmak istiyorum, böylece rakip bulursak ilanı kaldırırım.
21. Rakip arayan bir takım olarak, önümüzdeki günlerde rakip arayan bütün maçları tek listede görmek istiyorum, böylece bize uyan maçı seçerim.
22. Rakip arayan bir takım olarak, ilandaki takım adını, sahayı, günü ve saati görmek istiyorum, böylece kime karşı ne zaman oynayacağımı bilirim.
23. Rakip arayan bir takım olarak, takım adımı yazıp maça anında rakip olarak katılmak istiyorum, böylece onay beklemem.
24. Rakip olarak katılan bir takım olarak, kendi kodumu almak istiyorum, böylece maçı görebilir ve gerekirse ayrılabilirim.
25. Rakip olarak katılan bir takım olarak, maç başlamadan kodumla ayrılmak istiyorum, böylece ev sahibi yeniden rakip arayabilir.
26. Rakip arayan bir takım olarak, aynı maça benden önce biri katıldıysa net bir mesaj görmek istiyorum, böylece başka maça bakarım.
27. Bir ev sahibi takım olarak, kodumla baktığımda rakibimin adını görmek istiyorum, böylece kiminle oynayacağımı bilirim.
28. Rakip olarak katılan bir takım olarak, ev sahibi maçı iptal ettiyse kodumla baktığımda bunu görmek istiyorum, böylece sahaya boşuna gitmem.
29. Bir ev sahibi takım olarak, rakibim ayrılırsa ilanımın yeniden listeye dönmesini istiyorum, böylece yeni rakip bulabilirim.

### İşletmeci

30. Bir işletmeci olarak, panele şifreyle girmek istiyorum, böylece yönetim işlemlerini yalnız ben yaparım.
31. Bir işletmeci olarak, seçtiğim günün iki sahadaki doluluğunu tek ekranda görmek istiyorum, böylece defter açmadan durumu bilirim.
32. Bir işletmeci olarak, her dolu saatte takım adını ve varsa rakip takımı görmek istiyorum, böylece sahaya geleni tanırım.
33. Bir işletmeci olarak, günler arasında ileri geri geçmek istiyorum, böylece haftayı planlarım.
34. Bir işletmeci olarak, herhangi bir rezervasyonu iptal etmek istiyorum, böylece telefonla haber veren ya da uygunsuz adla açılan kayıtları kaldırırım.
35. Bir işletmeci olarak, boş bir saati ya da aynı gündeki birden çok saati bakım için kapatmak istiyorum, böylece o saatlere rezervasyon alınmaz.
36. Bir işletmeci olarak, kapattığım saate kısa bir not düşmek istiyorum, böylece neden kapattığımı hatırlarım.
37. Bir işletmeci olarak, kapattığım saati yeniden açmak istiyorum, böylece bakım erken biterse saat satışa döner.
38. Bir işletmeci olarak, panelden çıkış yapmak istiyorum, böylece ortak bir cihazda oturumum açık kalmaz.
39. Bir işletmeci olarak, oturumumun bir süre sonra kendiliğinden kapanmasını istiyorum, böylece unuttuğum bir cihaz açık kapı olmaz.

### Yayın, güvenlik ve işletim

40. Bir yayıncı olarak, uygulamanın hiçbir kişisel veri istememesini istiyorum, böylece izleyiciler çekinmeden dener ve veri sorumluluğu doğmaz.
41. Bir yayıncı olarak, tek bir kişinin bütün saatleri dolduramamasını istiyorum, böylece canlı deneme herkes için çalışır kalır.
42. Bir yayıncı olarak, herkese görünen takım adlarında küfür ve bağlantı olmamasını istiyorum, böylece videoda uygunsuz içerik çıkmaz.
43. Bir yayıncı olarak, çok sayıda izleyici aynı saate aynı anda bassa bile saatin tek takıma verilmesini istiyorum, böylece uygulamanın temel sözü bozulmaz.
44. Bir yayıncı olarak, kod tahmini ve panel şifresi denemelerinin sınırlanmasını istiyorum, böylece başkasının rezervasyonu ya da panel ele geçirilemez.
45. Bir geliştirici olarak, uygulamayı ve PostgreSQL'i tek komutla ayağa kaldırmak istiyorum, böylece yerelde ve VPS'te aynı şekilde çalıştırırım.
46. Bir geliştirici olarak, konteynerler yeniden oluşturulsa da verinin durmasını istiyorum, böylece güncelleme rezervasyonları silmez.
47. Bir geliştirici olarak, şifre ve gizli anahtarların ortam değişkeninden gelmesini ve eksikse uygulamanın başlamamasını istiyorum, böylece varsayılan şifreyle yayına çıkmam.
48. Bir geliştirici olarak, veritabanı şemasının ilk açılışta kendiliğinden kurulmasını istiyorum, böylece elle SQL çalıştırmam.

## Uygulama Kararları

### Teknoloji ve mimari

- Next.js + TypeScript, tek uygulama: arayüz ve sunucu mantığı aynı kod tabanında, tek konteyner.
- PostgreSQL tek kalıcı veri kaynağı. ORM yok; düz, parametreli SQL. Şema, sürümlü SQL göçleriyle uygulama açılışında kendiliğinden kurulur.
- Arayüz dili Türkçe, mobil öncelikli. Saat dilimi sabit Europe/Istanbul; "bugün" ve "geçmiş saat" buna göre hesaplanır.
- Canlı bağlantı (WebSocket) yok. Saat listesi her işlemden sonra, sayfaya dönüldüğünde ve yaklaşık 20 saniyede bir yenilenir. Doğruluk yenilemeye değil veritabanı kısıtına dayanır.

### Saat modeli

- İki saha sabit: Açık Saha ve Kapalı Saha.
- Saat dilimi 60 dakika, 09:00 ile 24:00 arası; saha başına günde 15 dilim.
- Rezervasyon penceresi bugün dahil 7 gün. Başlangıcı geçmiş dilim alınamaz.
- Çalışma saatleri, gün sayısı ve IP sınırı ortam değişkeniyle ayarlanır; kod değişikliği gerekmez.

### Modüller

1. **Rezervasyon çekirdeği** (derin modül). HTTP'den habersizdir; "şimdi" ve istemci özeti parametre olarak verilir. Arayüzü:
   - gün için uygunluk getir
   - rezervasyon oluştur
   - kodla getir
   - iptal et
   - rakip aramayı aç/kapat
   - rakip olarak katıl, rakip olarak ayrıl
   - rakip arayan maçları listele
   - işletmeci: gün dökümü, rezervasyon iptali, saat kapat, saat aç
   - eski kayıt temizliği
2. **Koruma katmanı.** Gerçek istemci IP'sini çözer ve özetler, hız limitini uygular, takım adını doğrular.
3. **Panel kimlik doğrulama.** Şifre denetimi, oturum çerezi, giriş deneme limiti.
4. **Web arayüzü** (ince katman). Takım sayfaları: saatler, rezervasyon formu, kod ekranı, kodla görüntüle, rakip arayanlar. Panel: giriş, gün görünümü. İş kuralı içermez, çekirdeği çağırır.
5. **Altyapı.** Şema göçleri, Docker Compose tanımı, sağlık denetimi ucu, örnek ortam dosyası.

### Veri modeli

- Tek bir saat kaydı tablosu hem rezervasyonu hem bakım kapatmasını tutar. Alanlar: saha, tarih, başlangıç saati, tür (rezervasyon ya da bakım), durum (aktif ya da iptal), takım adı, kod özeti, rakip arıyor işareti, rakip takım adı, rakip kod özeti, ev sahibi ve rakip için IP özeti, bakım notu, oluşturulma zamanı, iptal zamanı, iptal eden (takım ya da işletmeci).
- **Çift rezervasyon garantisi:** saha + tarih + saat üzerinde yalnız aktif kayıtları kapsayan tekil kısıt. Rezervasyon ve bakım aynı tabloda olduğu için tek kısıt ikisini de korur. Uygulama katmanında "önce bak sonra yaz" denetimine güvenilmez; kısıt ihlali "bu saat az önce alındı" mesajına çevrilir.
- **Rakip katılımı** tek, koşullu bir güncellemedir: yalnız rakibi olmayan, rakip arayan, aktif ve başlamamış kayıt güncellenir. Etkilenen satır yoksa "bu maça az önce başka takım katıldı" döner.
- İptal edilen kayıt silinmez, durumu değişir; böylece kod sahibi iptali ve kimin iptal ettiğini görebilir.
- Maç tarihi üzerinden 7 gün geçen kayıtlar periyodik olarak tümüyle silinir.

### Rezervasyon kodu

- 8 karakter, birbirine karışan karakterler (0/O, 1/I/L) çıkarılmış alfabe, kriptografik rastgele üretim.
- Veritabanında yalnız özeti saklanır; kod yalnız oluşturma anında bir kez gösterilir.
- Ev sahibi ve rakip ayrı kod alır. Tek "kodla görüntüle" girişi ikisini de çözer ve role göre işlem sunar: ev sahibi iptal eder ve rakip aramayı açıp kapatır, rakip ayrılır.
- Kayıp kod kurtarılamaz; çözüm işletmecinin panelden iptal etmesidir.

### İş kuralları

- Takım iptali başlangıç saatine kadar yapılır; saat anında boşalır.
- Ev sahibi iptal ederse maç tümden iptal olur, saat boşalır, rakibin kodu "ev sahibi iptal etti" gösterir. Saat rakibe devredilmez.
- Rakip ayrılırsa kayıt yeniden "rakip arıyor" durumuna döner.
- Rakip arama işareti yalnız rakip yokken açılıp kapatılabilir.
- Herkese açık saat listesinde dolu saatler yalnız "Dolu" olarak görünür. Takım adı yalnız rakip arayan maçlarda herkese görünür.
- İşletmeci yalnız boş saati kapatabilir; dolu saati kapatmak için önce rezervasyonu iptal eder.

### Kötüye kullanım koruması

- IP başına aynı anda en fazla 3 aktif, gelecekteki kayıt; rakip katılımları da sayılır. Sayım ve kayıt aynı veritabanı işleminde, IP özeti başına kilitle yapılır ki eşzamanlı istekler sınırı aşamasın.
- Hız limiti: yazma işlemleri ve kod sorguları IP başına dakikada 10, panel girişi IP başına 15 dakikada 5 deneme. Aşımda 429 ve anlaşılır mesaj.
- IP düz saklanmaz; gizli anahtarla alınmış özeti saklanır ve kayıtla birlikte silinir.
- Gerçek IP, vekil başlığından yalnız yapılandırılmış güvenilir vekil sayısına göre okunur; aksi halde başlık sahteleyen sınırı aşar.
- Takım adı: baştaki ve sondaki boşluk kırpılır, 2 ile 24 karakter, Türkçe harfler dahil harf, rakam, boşluk ve temel noktalama. Bağlantı ve HTML reddedilir, gömülü küçük bir küfür listesine karşı harf varyasyonları normalleştirilerek denetlenir.
- Kullanıcıdan gelen her metin ekranda kaçışlı gösterilir. İstek gövdesi boyutu sınırlıdır. Bütün girdiler sunucuda doğrulanır; arayüz doğrulaması yalnız kolaylıktır.

### Panel kimlik doğrulama

- Tek şifre, ortam değişkeninden. Kullanıcı tablosu yok.
- Şifre sabit zamanlı karşılaştırılır. Başarılı girişte imzalı, HttpOnly, Secure, SameSite çerez verilir; oturum 12 saat sonra biter.
- Durum değiştiren bütün istekler kaynak (origin) denetiminden geçer.
- Panel uçları oturumsuz istekte veri döndürmez.
- Panel şifresi, oturum anahtarı ya da IP özet anahtarı eksik ya da çok kısaysa uygulama başlamaz.

### API sözleşmesi (kavramsal)

- Uygunluk: tarih verilir; iki saha için her dilimin durumu döner (boş, dolu, bakımda, geçmiş, rakip arıyor ve takım adı).
- Rezervasyon oluştur: saha, tarih, saat, takım adı, rakip arıyor işareti verilir; kod döner. Hatalar: saat dolu, sınır aşıldı, geçersiz ad, geçmiş saat, pencere dışı, hız limiti.
- Kodla getir: kod verilir; rol ve maç bilgisi ya da "bulunamadı" döner.
- İptal, rakip aramayı aç/kapat, rakipten ayrıl: kod verilir.
- Rakip olarak katıl: maç ve takım adı verilir; rakip kodu döner.
- Panel: giriş, çıkış, gün dökümü, rezervasyon iptali, saat kapat, saat aç.

### Dağıtım

- Docker Compose iki servis içerir: uygulama ve PostgreSQL. Tek komutla ayağa kalkar.
- PostgreSQL verisi adlandırılmış bir volume'da durur. PostgreSQL portu dışarı açılmaz; yalnız uygulama iç ağdan erişir.
- Uygulama, PostgreSQL sağlıklı olduktan sonra başlar, göçleri uygular ve bir sağlık ucu sunar. İki servis de çökünce yeniden başlar. Uygulama konteynerde yetkisiz kullanıcıyla çalışır.
- Uygulama tek bir port açar. HTTPS ve alan adı VPS'teki mevcut ters vekilin işidir; Compose'a vekil eklenmez.
- Bütün gizli değerler ve ayarlar ortam dosyasından gelir. Depoda yalnız örnek ortam dosyası bulunur.

## Test Kararları

- İyi test yalnız dışa dönük davranışı sınar: modülün arayüzünden çağrı yapar, dönen sonuca ve sonraki çağrıların gördüğü duruma bakar. Tablo yapısına, iç fonksiyonlara ya da SQL metnine bağlanmaz.
- Otomatik test yazılacak tek modül **rezervasyon çekirdeği**. Testler gerçek PostgreSQL'e karşı çalışır; veritabanı taklit edilmez, çünkü çift rezervasyon garantisi veritabanı kısıtındadır. Zaman parametreyle verilir, saat taklidi gerekmez.
- Kapsanacak davranışlar:
  - Uygunluk listesi boş, dolu, bakımda ve geçmiş dilimleri doğru gösterir.
  - Rezervasyon kod döndürür; kodla getirilen bilgi doğrudur; yanlış kod bulunamadı döner.
  - Aynı dilime eşzamanlı çok sayıda istekten tam biri başarılı olur.
  - İptal saati boşaltır; başlamış maç iptal edilemez; pencere dışı ve geçmiş dilim alınamaz.
  - Rakip arama açılır ve kapanır; eşzamanlı katılımlardan tam biri kazanır; rakip ayrılınca ilan geri döner; ev sahibi iptalinde rakip kodu iptali görür.
  - Bakım kapatması rezervasyonu engeller; dolu saat kapatılamaz; açılan saat yeniden alınabilir.
  - IP başına aktif kayıt sınırı, eşzamanlı isteklerde de aşılmaz.
- Koruma katmanı, panel kimlik doğrulama ve uçtan uca akış için otomatik test yazılmayacak; bunlar aşağıdaki kabul kriterleriyle elle doğrulanır.
- Proje yeni olduğundan örnek alınacak mevcut test yok.

## Kabul Kriterleri

1. Temiz bir makinede, örnek ortam dosyası doldurulduktan sonra tek `docker compose up` komutu uygulamayı ve PostgreSQL'i ayağa kaldırır; sağlık ucu 200 döner; elle hiçbir SQL çalıştırılmaz.
2. Bir rezervasyon alındıktan sonra konteynerler silinip yeniden oluşturulduğunda (volume korunarak) aynı kod rezervasyonu göstermeye devam eder.
3. Uçtan uca akış çalışır: saat seç, takım adı yaz, kod al, kodla görüntüle, iptal et, saat yeniden boş görünür.
4. Aynı saha, gün ve saate gönderilen 50 eşzamanlı rezervasyon isteğinden tam 1'i başarılı olur; veritabanında o dilim için tek aktif kayıt bulunur.
5. Rakip akışı çalışır: "rakip arıyoruz" işaretli maç listede görünür, ikinci takım katılır ve kod alır, maç listeden düşer, rakip ayrılınca listeye döner. Aynı maça 20 eşzamanlı katılım isteğinden tam 1'i başarılı olur.
6. Aynı IP'den 4. aktif rezervasyon reddedilir; biri iptal edilince yenisi alınabilir.
7. Dakikada 10'dan fazla yazma ya da kod sorgusu isteği 429 döner.
8. Küfür içeren, bağlantı içeren, 2 karakterden kısa ya da 24 karakterden uzun takım adı reddedilir; HTML içeren ad hiçbir ekranda işlenmiş (çalışan) biçimde görünmez.
9. Panel sayfaları ve panel işlemleri oturumsuz erişimde veri döndürmez. Doğru şifreyle giriş yapılır; 15 dakikada 5 yanlış denemeden sonra giriş geçici olarak reddedilir.
10. İşletmeci panelde seçtiği günün iki sahasını görür, bir rezervasyonu iptal eder (takımın kodu "işletmeci iptal etti" gösterir), bir saati kapatır (takım o saati alamaz) ve yeniden açar.
11. Veritabanında düz IP adresi ve düz rezervasyon kodu bulunmaz; uygulama hiçbir ekranda ad, telefon ya da e-posta istemez.
12. Panel şifresi ya da gizli anahtarlar boşken uygulama başlamaz ve nedenini loglar.
13. 360 piksel genişlikte bütün takım ekranları yatay kaydırma olmadan kullanılır; dokunma hedefleri en az 44 piksel yüksekliğindedir.
14. Rezervasyon çekirdeği testlerinin tamamı geçer; build, tip denetimi ve lint hatasız tamamlanır.
15. PostgreSQL portuna konteyner ağı dışından erişilemez.

## Kapsam Dışı

- Üyelik, takım hesabı, profil.
- Ödeme, kapora, fiyat gösterimi.
- SMS, e-posta, WhatsApp ya da anlık bildirim.
- Telefon numarası ya da herhangi bir iletişim bilgisi toplama; eşleşen takımların iletişimi sahada kurulur.
- Rakip isteğinde ev sahibi onayı, takımlar arası mesajlaşma, puanlama.
- Tekrarlayan (haftalık abonelik) rezervasyon, bekleme listesi.
- Birden fazla işletme ya da ikiden fazla saha yönetimi, panelden saha ve saat ayarı.
- Birden fazla yönetici hesabı, panelden şifre değiştirme.
- CAPTCHA ya da harici bot koruması.
- Compose içinde ters vekil ve HTTPS sertifikası; alan adı ayarı.
- Canlı (anlık) güncelleme, yerel mobil uygulama, çoklu dil.
- Raporlama, geçmiş istatistikleri, dışa aktarma.
- Otomatik veritabanı yedeği.

## Notlar

**Kullanıcıyla netleştirilen kararlar:** Next.js + TypeScript; 60 dakika, 09:00 ile 24:00, 7 gün; IP sınırı + hız limiti + ad filtresi; rakipte ilk gelen onaysız katılır; panelde ortam değişkeninden tek şifre; Compose yalnız uygulama + PostgreSQL; iptal başlangıç saatine kadar; otomatik test yalnız rezervasyon çekirdeği için.

**Sorulmadan alınan, teyit edilmesi iyi olacak varsayımlar:**

- Hız limiti sayaçları kalıcı iş verisi olmadığı için uygulama belleğinde tutulur; yeniden başlatmada sıfırlanır. Rezervasyon, kapatma ve sınır sayımı dahil bütün iş verisi PostgreSQL'dedir. Sayaçların da veritabanında durması istenirse bu karar değişir.
- Dolu saatlerde takım adı herkese gösterilmez; yalnız rakip arayan maçlarda görünür.
- Kod 8 karakterdir, özetlenerek saklanır ve kaybedilirse kurtarılamaz.
- Maç tarihi üzerinden 7 gün geçen kayıtlar silinir; işletmeci daha eski geçmişi göremez.
- Saat listesi yaklaşık 20 saniyede bir yenilenir.
- İşletmeci dolu saati doğrudan kapatamaz, önce iptal eder.
- Ev sahibi iptal edince saat rakibe geçmez, boşalır.
- Aynı takım adı birden çok rezervasyonda kullanılabilir.

**Yayına özel riskler:**

- Toplam kapasite 2 saha, 15 dilim, 7 gün: 210 dilim. Kalabalık bir yayında dakikalar içinde dolabilir. Gün sayısı ve IP sınırı ortam değişkeninden ayarlanır; işletmeci panelden toplu olmasa da tek tek iptal edebilir.
- Aynı mobil operatörü kullanan izleyiciler aynı IP'yi paylaşabilir ve 3 kayıtlık sınıra birlikte takılabilir. Yayın öncesi sınır yükseltilebilir.
- IP özeti teknik olarak dolaylı bir tanımlayıcıdır. Kullanıcıdan hiçbir veri istenmez, ama bu özet yalnız sınır denetimi için tutulur ve kayıtla birlikte silinir.
- Küfür listesi her varyasyonu yakalayamaz; kaçanlar için işletmeci iptali son savunmadır.
- VPS'teki ters vekilin gerçek istemci IP'sini başlıkta iletmesi ve güvenilir vekil sayısının doğru ayarlanması şarttır. Yanlış ayarda ya herkes tek IP sayılır ya da sınır başlık sahteleyerek aşılır.
- Panel şifresi ve ortam dosyası videoda ekrana gelmemelidir.
