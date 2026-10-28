# API & Webhook Radar

![CI Quality Gates](https://github.com/ajiarl/api-radar/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Nuxt 4](https://img.shields.io/badge/Nuxt-4.6.2-00DC82?logo=nuxt.js)
![Nitro](https://img.shields.io/badge/Nitro-2.13.4-black)
![Nuxt UI](https://img.shields.io/badge/Nuxt%20UI-v3-00DC82)
![Vitest](https://img.shields.io/badge/Vitest-v5.0.5-6E9F18?logo=vitest)

> **Developer Diagnostic & Ingress Cockpit** — Realtime endpoint watcher, outbound HTTP probe engine, SSRF-guarded proxy, and multi-channel webhook receiver built with Nuxt 4, Nitro Engine, and Nuxt UI.
[![Nitro Engine](https://img.shields.io/badge/Nitro-2.13.4-F43F5E?logo=nitro&logoColor=white)](https://nitro.unjs.io)
[![Nuxt UI](https://img.shields.io/badge/Nuxt_UI-4.12.0-00DC82)](https://ui.nuxt.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4.3-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict_6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)

> **API & Webhook Radar** adalah developer cockpit berkinerja tinggi dan zero-cost self-hosted untuk memantau status, latensi round-trip mikroservis, ketersediaan gateway lokal/cloud, serta menangkap ingress payload webhook secara real-time. Dibangun mematuhi standar audit 15 Bab SOP Web Fullstack Hardening (`Panduan.txt`).

---

## Fitur Utama

- **Outbound HTTP Probe Engine (`POST /api/radar/ping`)**:
  - Mengukur latensi presisi menggunakan `performance.now()`.
  - Pelindung timeout mutlak `AbortSignal.timeout(5000)` sehingga server Nitro tidak akan hang jika target down.
  - Pembatasan ukuran payload cuplikan response hingga maksimal 50KB.
  - Penanganan error anggun (504 Gateway Timeout / 502 Bad Gateway) tanpa memutus server runtime.
- **Anti-SSRF Protection Guard (`server/utils/ssrf.ts`)**:
  - Menolak protokol selain `http:` dan `https:`.
  - Memblokir loopback (`127.0.0.0/8`, `::1`), range IP privat RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), Cloud Metadata (`169.254.169.254`), CGNAT (`100.64.0.0/10`), dan IPv6 Unique Local.
  - Bypass terisolasi khusus pengujian pengembang (`allowLocal: true`) untuk menguji gateway lokal seperti 9Router port 20128.
- **Target Management (`/api/radar/targets`)**:
  - Menyimpan dan mengelola daftar endpoint yang dipantau menggunakan storage bawaan Nitro (`unstorage`).
  - Dilengkapi default targets bootstrap (`9Router Local Gateway` & `GitHub API Status`).
- **Ingress Webhook Collector & Viewer (`/api/webhook/[channelId]`)**:
  - Catch-all collector untuk menangkap request webhook masuk dari GitHub, Stripe, Telegram, atau custom client.
  - **Sanitasi Otomatis**: Sensor nilai credential sensitif (`Authorization`, `Cookie`, `X-Api-Key`, `Token`, `Secret`) menjadi `***MASKED***`.
  - Ingress Viewer visual di dashboard untuk membedah headers, query parameter, dan body payload JSON.
- **Clean SaaS Dashboard UI**:
  - Tampilan bersih, lega, dan elegan sesuai acuan Superdesign (`max-w-6xl` terpusat, light mode murni).
  - 3 Overview Cards metrik ringkas: Total Endpoint, Rata-rata Latensi, dan Tingkat Uptime.
  - Auto-refresh polling reaktif (Off, 5s, 10s, 30s) ditenagai `@vueuse/core`.
  - Quick cURL generator dengan fitur salin sekali klik.
- **Production Hardening (15-Bab Panduan.txt)**:
  - Security headers bawaan: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
  - Synthetic health probe route `GET /api/health` untuk uptime checker eksternal.

---

## Arsitektur Proyek

```text
api-radar/
├── app/
│   ├── app.vue                     # Layout wrapper, Navbar bersih, Footer, dan SEO Meta
│   ├── assets/css/main.css         # Tailwind v4, Nuxt UI theme, global light mode lock
│   └── pages/
│       └── index.vue               # Dashboard cockpit (Target table, Inspector, Webhook viewer, Modal)
├── server/
│   ├── utils/
│   │   ├── ssrf.ts                 # Helper validasi anti-SSRF IP privat/loopback/cloud metadata
│   │   └── targets.ts              # Interface target monitoring & bootstrap seed
│   └── api/
│       ├── health.get.ts           # Synthetic health probe (/api/health)
│       ├── radar/
│       │   ├── ping.post.ts        # Outbound HTTP probe & latency calculator
│       │   ├── targets.get.ts      # Daftar target tersimpan di Nitro storage
│       │   └── targets.post.ts     # Pendaftaran target endpoint baru via Zod
│       └── webhook/
│           ├── [channelId].all.ts  # Ingress webhook catch-all collector
│           └── logs.get.ts         # Endpoint pembaca log webhook masuk
├── docs/
│   ├── audit/                      # 14 Laporan audit kepatuhan 15-Bab Panduan.txt
│   ├── 01-fase-1-nitro-backend-core.md
│   ├── 02-fase-2-frontend-dashboard-ui.md
│   ├── 03-fase-3-hardening-dan-audit.md
│   └── ROADMAP.md                  # Milestone & acceptance matrix
└── nuxt.config.ts                  # Konfigurasi modul, colorMode cookie, routeRules security headers
```

---

## Instalasi & Menjalankan Lokal

### Prasyarat
- **Node.js**: `>= 22.0.0`
- **Package Manager**: `pnpm` (disarankan `pnpm@12+`)

### 1. Kloning & Instalasi Dependensi
```bash
git clone https://github.com/owner/api-radar.git
cd api-radar
pnpm install
```

### 2. Jalankan Mode Development
```bash
pnpm dev
```
Buka browser di `http://localhost:3000`.

### 3. Build & Preview Produksi
```bash
# Compile bundle produksi Nitro & Client
pnpm build

# Jalankan server mandiri produksi
node .output/server/index.mjs
# Atau menggunakan script preview:
pnpm preview
```

---

## Spesifikasi REST API & Panduan cURL

### 1. Synthetic Health Probe
Memeriksa status hidup aplikasi untuk pemantau uptime eksternal (misal: BetterStack, Uptime Kuma).
```bash
curl -X GET http://127.0.0.1:3000/api/health
```
**Respons (200 OK):**
```json
{
  "status": "ok",
  "service": "api-radar",
  "uptime": 142.5,
  "timestamp": "2026-10-28T07:30:00.000Z"
}
```

### 2. Trigger Outbound Probe (`POST /api/radar/ping`)
Memeriksa endpoint target, menghitung latensi, dan menyimpan riwayat ke storage.

**A. Target Eksternal Aman:**
```bash
curl -X POST http://127.0.0.1:3000/api/radar/ping \
  -H "Content-Type: application/json" \
  -d '{"id":"tgt-github","url":"https://api.github.com/zen","method":"GET","allowLocal":false}'
```

**B. Pengujian SSRF Protection (Ditolak Otomatis 403 Forbidden):**
```bash
curl -i -X POST http://127.0.0.1:3000/api/radar/ping \
  -H "Content-Type: application/json" \
  -d '{"url":"http://192.168.1.1/admin","allowLocal":false}'
```

**C. Target Lokal Dev (Bypass Diizinkan):**
```bash
curl -X POST http://127.0.0.1:3000/api/radar/ping \
  -H "Content-Type: application/json" \
  -d '{"id":"tgt-9router","url":"http://127.0.0.1:20128/v1/models","method":"GET","allowLocal":true}'
```

### 3. Daftar Target (`GET & POST /api/radar/targets`)
```bash
# Ambil semua target
curl -X GET http://127.0.0.1:3000/api/radar/targets

# Tambah target baru
curl -X POST http://127.0.0.1:3000/api/radar/targets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cloudflare Status",
    "url": "https://www.cloudflarestatus.com",
    "method": "GET",
    "allowLocal": false
  }'
```

### 4. Kirim Ingress Webhook (`ALL /api/webhook/:channelId`)
Menangkap data masuk pada channel apa pun dengan penyensoran kredensial otomatis.
```bash
curl -X POST "http://127.0.0.1:3000/api/webhook/github-events?env=production" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer secret_live_token_123" \
  -H "Cookie: session_user=alice_secret" \
  -H "X-Api-Key: key_sec_456" \
  -d '{"event":"push","repository":"api-radar","ref":"refs/heads/master"}'
```

### 5. Baca Log Webhook Masuk (`GET /api/webhook/logs`)
```bash
curl -X GET http://127.0.0.1:3000/api/webhook/logs
```

---

## Verifikasi Kualitas & Quality Gate

Proyek ini wajib lulus tiga gerbang pengujian mandatori sebelum siap deploy:

| Perintah | Deskripsi | Standar Kelulusan |
|---|---|---|
| `pnpm run lint` | ESLint (Nuxt, Stylistic, Tailwind correctness) | **0 error, 0 warning** |
| `pnpm run typecheck` | TypeScript Compiler (`vue-tsc` / `nuxt typecheck`) | **0 type error** |
| `pnpm run build` | Nitro Bundler & Client Engine compilation | **✨ Build complete** |

---

## Panduan Deployment

### 1. Vercel (Serverless Edge)
Pastikan preset terdeteksi otomatis atau atur environment:
```bash
# Build command:
pnpm run build
# Output directory:
.output
```

### 2. Node.js Standalone (Docker / VPS / Coolify)
Server Nitro yang dihasilkan di `.output/` mandiri dan tidak memerlukan dependensi eksternal:
```bash
node .output/server/index.mjs
```
Variabel lingkungan yang didukung:
- `PORT`: Port server (default: `3000`).
- `HOST`: Host listener (default: `0.0.0.0`).

---

## Lisensi

Dilisensikan di bawah [MIT License](LICENSE).
