# LAPORAN PERFORMANCE DAN OPTIMASI: BAGIAN V (Panduan.txt)
**Proyek:** API & Webhook Radar  
**Tolok Ukur Standar:** Panduan.txt Seksi 17-20 (Baris 525-584), Google web.dev Core Web Vitals  
**Status:** Baseline Specification

---

## 1. Target Core Web Vitals

| Metrik | Ambang Batas Target | Strategi Pencapaian di Nuxt |
|---|---|---|
| **LCP (Largest Contentful Paint)** | < 1.0 detik | SSR render awal tabel di server, eliminasi font pihak ketiga yang berat. |
| **INP (Interaction to Next Paint)** | < 100 ms | Event listener ringan, manipulasi state lokal non-blocking. |
| **CLS (Cumulative Layout Shift)** | 0.00 | Dimensi tabel dan card dialokasikan secara statis tanpa lonjakan layout mendadak. |

---

## 2. Optimasi Server & Payload
1. **Network Overhead Minimal:** Server Nitro hanya mengembalikan subset data yang dibutuhkan client (status, latency, timing, snippet body) dan memotong body jika melebihi 50 KB untuk mencegah memory bloat.
2. **Vite Code Splitting:** Dependency modal dan slideover di-chunking terpisah oleh bundler Vite.
