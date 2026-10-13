// Applied architecture decisions for lessons otherwise using the generic lab.
// Keep bespoke HTTP, messaging, Saga and pattern simulators unchanged.
export const architectureScenarios = {
  'ddd-basics': [
    {
      evidence: 'CRM için Customer kampanya segmentidir. Sipariş için Customer teslimat ve ödeme sahibidir.',
      prompt: 'İki ekip Customer bilgisini nasıl modellemeli?',
      options: ['Tek ortak Customer entity + ortak tablo', 'Her bounded context kendi modelini kurar; entegrasyon sözleşmesi tanımlar', 'CRM diğer servisin internal entity class’ını import eder'],
      answer: 1,
      feedback: ['Tek model farklı iş kurallarını birbirine bağlar.', 'Aynı kelime farklı iş bağlamlarında farklı anlam taşıyabilir.', 'Internal class paylaşımı bounded context sınırını delerek coupling yaratır.'],
      takeaway: 'Bounded context, tutarlı domain dili ve modelinin sınırıdır; birebir mikroservis demek değildir.',
    },
    {
      evidence: 'Order total ile order lines toplamı ve indirim kuralı aynı iş işlemi içinde tutarlı kalmalı.',
      prompt: 'Bu invariant nerede korunmalı?',
      options: ['Yalnız frontend form validation’da', 'Satırları ayrı ayrı kaydet, sonra kontrol et', 'Order aggregate davranışında, uygun atomik transaction sınırıyla'],
      answer: 2,
      feedback: ['Client kontrolü atlatılabilir.', 'Aggregate içindeki zorunlu invariant bozulabilir.', 'Aggregate, birlikte tutarlı kalması gereken domain durumunu korur.'],
      takeaway: 'Aggregate sınırını, atomik korunması gereken business invariant’ları belirler.',
    },
  ],
  'service-boundary': [
    {
      evidence: 'Order ile Payment değişimleri farklı ekiplerde; sağlayıcı değişince sipariş kodu sık bozuluyor.',
      prompt: 'Servis sınırını neye göre değerlendirirsin?',
      options: ['Her Java class için servis', 'Business capability, değişim nedeni ve veri ownership', 'Her Controller için servis'],
      answer: 1,
      feedback: ['Bu kadar küçük servisler ağ ve operasyon yükünü artırır.', 'Bağımsız değişim ve veri sahipliği güçlü sınır işaretleridir.', 'Controller sayısı iş sınırı göstermez.'],
      takeaway: 'Servis sınırında cohesion, business capability ve bağımsız değişimi birlikte değerlendir.',
    },
    {
      evidence: 'İki modül aynı DB transaction’ı paylaşıyor; ekip distributed consistency işletmeye hazır değil.',
      prompt: 'İlk makul mimari hamle?',
      options: ['Hemen iki servise böl', 'İki servis aynı tabloları güncellesin', 'Modüler monolith sınırlarını güçlendir; ayrışmayı gerekçelendir'],
      answer: 2,
      feedback: ['Dağıtık transaction ve hata durumları hesaba katılmadı.', 'Ortak schema deployment coupling üretir.', 'Transaction basit kalırken modül sınırı netleşir.'],
      takeaway: 'Mikroservis zorunlu başlangıç değildir; modüler monolith birçok ekipte daha düşük maliyetlidir.',
    },
  ],
  'microservice-resilience': [
    {
      evidence: 'Checkout için toplam latency bütçesi 900ms. Payment bazen 2 saniyeyi aşıyor.',
      prompt: 'Timeout nasıl tasarlanmalı?',
      options: ['Payment timeout 10 saniye olsun', 'End-to-end süre bütçesini alt çağrılara paylaştır; kontrollü hata/fallback tasarla', 'Timeout’u kaldır'],
      answer: 1,
      feedback: ['Alt çağrı toplam deadline’ı aşar ve birikme yaratır.', 'Alt çağrı timeout’ları uçtan uca süre hedefine uymalıdır.', 'Sonsuz bekleme thread ve connection havuzlarını tüketebilir.'],
      takeaway: 'Timeout, tek dependency’ye göre değil end-to-end latency budget’a göre seçilir.',
    },
    {
      evidence: 'POST /charge 503 döndü. Aynı ödemenin tekrarı çift tahsilat yaratabilir.',
      prompt: 'Retry hangi koşulla yapılabilir?',
      options: ['Her hatada sınırsız retry', 'Her denemede yeni idempotency key', 'Aynı idempotency key, sınırlı retry, backoff/jitter ve hata sınıflaması'],
      answer: 2,
      feedback: ['Retry storm ve çift side effect riski taşır.', 'Yeni key ikinci tahsilatı ayrı işlem saydırabilir.', 'Aynı logical ödeme korunur; geçici hatalarda sınırlı tekrar uygulanır.'],
      takeaway: 'Retry güvenliği method adıyla değil side effect ve idempotency sözleşmesiyle belirlenir.',
    },
  ],
  'service-discovery-load-balancing': [
    {
      evidence: 'Payment üç Kubernetes pod’unda çalışıyor; deploy sonrası pod IP’leri değişiyor.',
      prompt: 'Order Service Payment’a nasıl ulaşmalı?',
      options: ['Pod IP’lerini kaynak koda yaz', 'Kubernetes Service DNS gibi stabil logical ad kullan', 'Tek pod ile IP değişimini engelle'],
      answer: 1,
      feedback: ['Pod adresleri geçicidir.', 'Stabil servis adı değişen backend endpoint’lerine yönlendirilir.', 'Tek pod kullanılabilirliği ve kapasiteyi sınırlar.'],
      takeaway: 'Discovery endpoint bulur; load balancing istekleri uygun instance’lara dağıtır.',
    },
    {
      evidence: 'Payment pod HTTP portu açtı ama DB bağlantısı henüz hazır değil.',
      prompt: 'Yeni istek kabulünü hangi mekanizma belirlemeli?',
      options: ['Readiness probe geçene kadar trafiği dışarıda tut', 'Port açıksa hemen tüm trafiği yönlendir', 'Liveness başarısızsa pod’u kalıcı sistemden kaldır'],
      answer: 0,
      feedback: ['Readiness hazır olmayan pod’u servis trafiğinden korur.', 'Açık port, işlevsel hazır olma kanıtı değildir.', 'Liveness yeniden başlatma kararı içindir.'],
      takeaway: 'Readiness trafik kabulü, liveness yeniden başlatma sinyalidir.',
    },
  ],
  'independent-deployment': [
    {
      evidence: 'Order ile Payment ayrı container; ikisi de orders tablosuna yazıyor ve schema değişiminde beraber deploy ediliyor.',
      prompt: 'Gerçek bağımsız deploy için ne gerekir?',
      options: ['İki farklı port yeterli', 'Birlikte release zorunlu tutulsun', 'Veri ownership ayır, API/event contract ile bağla'],
      answer: 2,
      feedback: ['Port ayrımı schema coupling’i çözmez.', 'Zorunlu eş zamanlı release bağımsızlığı bozar.', 'Tek owner ve açık sözleşmeler release bağımlılığını azaltır.'],
      takeaway: 'Ayrı container, independently deployable olmak için tek başına yeterli değildir.',
    },
    {
      evidence: 'Payment response’una opsiyonel yeni alan eklenecek; eski Order sürümü üretimde kalacak.',
      prompt: 'Release stratejisi ne olmalı?',
      options: ['Tüm servisleri aynı dakika deploy et', 'Geriye uyum ve consumer contract testlerini koru; breaking change’i aşamalı taşı', 'Response alanlarını aniden yeniden adlandır'],
      answer: 1,
      feedback: ['Lockstep deploy bağımsızlığı azaltır.', 'Farklı sürümler contract bozulmadan birlikte çalışabilir.', 'Eski client beklemediği response ile bozulabilir.'],
      takeaway: 'Backward compatibility ve expand/contract yaklaşımı bağımsız deploy’u mümkün kılar.',
    },
  ],
  'microservice-principles': [
    {
      evidence: 'Dört kişilik ekip 12 servis için sürekli alarm ve deploy yükü yaşıyor; trafik küçük.',
      prompt: 'Mimariyi nasıl değerlendirirsin?',
      options: ['Her entity için yeni servis aç', 'Bağımsız değişim faydasını operasyon maliyetiyle karşılaştır; sınırları gerekirse birleştir', 'Ölçüm yapmadan yeni orkestratöre geç'],
      answer: 1,
      feedback: ['Dağıtık sistem maliyetini büyütür.', 'Mimari değer üretmiyorsa servis sınırları yeniden ele alınabilir.', 'Orkestratör yanlış servis sınırını düzeltmez.'],
      takeaway: 'Mikroservis bir trade-off; otomatik ölçeklenebilirlik veya hız garantisi değildir.',
    },
    {
      evidence: 'Order deploy’undan sonra Payment 5xx arttı; ekipler isteğin nerede bozulduğunu bulamıyor.',
      prompt: 'Operasyon tarafında en kritik ekleme?',
      options: ['Hata loglarını kapat', 'Her servise aynı DB connection string ver', 'Correlation/trace ID, dağıtık tracing, service metrics ve ownership'],
      answer: 2,
      feedback: ['Teşhis sinyalini yok eder.', 'Ortak DB sorunun kaynağını göstermez.', 'Çağrı zinciri ve servis sorumluluğu ölçülebilir olur.'],
      takeaway: 'Observability ve açık ownership, dağıtık sistemin operasyonel gereksinimleridir.',
    },
  ],
}
