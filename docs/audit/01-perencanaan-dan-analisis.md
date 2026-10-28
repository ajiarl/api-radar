# LAPORAN PERENCANAAN & ANALISIS: BAGIAN I (Panduan.txt)
**Proyek:** API & Webhook Radar (Nuxt 4 / Nitro Engine)  
**Tolok Ukur Standar:** Panduan.txt Seksi 1-4 (Baris 20-139) & Rekayasa Kebutuhan Perangkat Lunak  
**Status:** Baseline Specification

---

## 1. Tujuan, Problem Statement & Nilai Tambah (Panduan.txt Seksi 1)

### A. Problem Statement
Developer modern membutuhkan alat inspeksi latency endpoint dan ingress webhook collector yang:
1. Tidak terhalang isu CORS browser saat probing API pihak ketiga atau service internal.
2. Tidak mewajibkan konfigurasi database PostgreSQL/MySQL yang berat hanya untuk memantau segelintir gateway.
3. Memiliki antarmuka web yang bersih, cepat diakses, dan menyediakan metrik latency akurat (ms) tanpa visual bloat.

### B. Nilai Tambah & Solusi
- **Nitro Engine Server-Side Probing:** Request dilakukan dari sisi server Nuxt (`$fetch.raw`), mengeliminasi blokir CORS di browser secara 100%.
- **Zero-Database Overhead:** Menggunakan driver `unstorage` Nitro (file-system lokal saat dev, in-memory saat serverless).
- **Embedded SSRF Protection:** Mencegah eksploitasi probe internal LAN/cloud metadata kecuali secara eksplisit diizinkan (`allowLocal`).

---

## 2. Analisis Kebutuhan Sistem (Panduan.txt Seksi 2)

### A. Functional Requirements (FR)
| ID | Kebutuhan Fungsional | Deskripsi |
|---|---|---|
| **FR-01** | Daftar Endpoint Target | Menampilkan daftar service/URL yang dipantau beserta status terakhir. |
| **FR-02** | Trigger Ping On-Demand | Tombol trigger probe manual per endpoint atau massal ("Ping Semua"). |
| **FR-03** | Pengukuran Latensi Akurat | Menghitung waktu round-trip request dalam milidetik (ms). |
| **FR-04** | Validasi Anti-SSRF | Memblokir IP privat RFC 1918 dan metadata cloud secara default. |
| **FR-05** | Ingress Webhook Collector | Menerima payload HTTP masuk di `/api/webhook/:channelId` dan menyimpannya. |
| **FR-06** | Formulir Tambah Endpoint | Form input dengan validasi format URL dan flag `allowLocal`. |
| **FR-07** | Detail Response Inspector | Menampilkan status code, timing breakdown, headers, dan body JSON. |
| **FR-08** | Synthetic Health Probe | Endpoint `/api/health` untuk memantau status aplikasi Radar itu sendiri. |

### B. Non-Functional Requirements (NFR)
| Aspek | Target Persyaratan |
|---|---|
| **Performance** | Halaman utama LCP < 1.0 detik, waktu proses server proxy < 50ms overhead. |
| **Security** | Zero SSRF ke private network, masking token otentikasi di log. |
| **Availability** | 99.9% uptime pada hosting serverless (Vercel / Cloudflare). |
| **Reliability** | Timeout mutlak 5 detik (`AbortSignal.timeout(5000)`) pada setiap outbound probe. |
| **Accessibility** | Memenuhi WCAG 2.2 Level AA (kontras rasio teks > 4.5:1, keyboard nav). |
