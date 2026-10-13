# Java Backend Öğrenme Atölyesi

Java, Spring Boot, mikroservis mimarisi ve yazılım mühendisliği konularında Türkçe, etkileşimli öğrenme uygulaması. React ve Vite ile geliştirilmiştir. Örnek senaryolar, kod alıştırmaları, mülakat soruları ve ilerleme takibi içerir.

## Çalıştırma

Node.js 22 ve npm gerekir.

```bash
npm ci
npm run dev
```

Kontrol ve üretim derlemesi:

```bash
npm test
npm run build
npm run preview
```

## Canlı sürüm

[Uygulamayı aç](https://zexy2.github.io/spring-boot-reactor/)

`main` dalına gönderilen her güncelleme, GitHub Actions üzerinde testlerden ve üretim derlemesinden geçer. İş akışı başarılı olursa GitHub Pages yayını güncellenir.

## İlerleme verileri

Uygulama tarayıcının `localStorage` alanını kullanır. Hesap ve sunucu senkronizasyonu yoktur. `localhost` üzerindeki ilerleme, canlı siteye otomatik taşınmaz; uygulamanın ilerleme yedekleme/içe aktarma özelliği kullanılmalıdır. Tarayıcı verilerini silmek kayıtları etkileyebilir.
