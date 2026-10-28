# Spesifikasi Teknis: Fase 1 — Nitro Backend & Storage Core

## 1. Tujuan Fase
Membangun fondasi server-side Nuxt 3/4 menggunakan Nitro Engine dan H3 event handlers tanpa ketergantungan database eksternal. Semua data target dan riwayat ping disimpan menggunakan Nitro native storage driver (`unstorage`).

---

## 2. Struktur File yang Dibangun

```text
server/
├── utils/
│   └── ssrf.ts                 # Helper validasi anti-SSRF IP privat/loopback
└── api/
    ├── health.get.ts           # Synthetic health probe (/api/health)
    ├── radar/
    │   ├── ping.post.ts        # Outbound probe trigger & latency calculator
    │   ├── targets.get.ts      # Ambil daftar endpoint yang dipantau
    │   └── targets.post.ts     # Tambah target endpoint baru
    └── webhook/
        └── [channelId].all.ts  # Ingress webhook catch-all collector
```

---

## 3. Rincian Teknis per Komponen

### A. SSRF Guard (`server/utils/ssrf.ts`)
- **Fungsi:** Memeriksa apakah hostname/IP yang di-request aman untuk di-probe.
- **Rules:**
  - Protokol wajib `http:` atau `https:`.
  - Jika `allowLocal === false`:
    - Blokir `localhost` dan `127.0.0.1` (loopback).
    - Blokir range IP privat: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.
    - Blokir cloud metadata: `169.254.169.254`.
  - Jika `allowLocal === true`:
    - Izinkan IP privat/loopback (digunakan khusus untuk probing gateway 9Router lokal di port 20128).

### B. Health Probe (`server/api/health.get.ts`)
- **Method:** `GET`
- **Output:**
  ```json
  {
    "status": "ok",
    "uptime": 142.5,
    "timestamp": "2026-10-28T13:00:00.000Z"
  }
  ```

### C. Outbound Ping Engine (`server/api/radar/ping.post.ts`)
- **Method:** `POST`
- **Input Body:** `{ id: string, url: string, method?: 'GET'|'POST', allowLocal?: boolean }`
- **Alur Eksekusi:**
  1. Validasi URL via `validateSsrf(url, allowLocal)`.
  2. Catat `startTime = performance.now()`.
  3. Panggil target via Nitro `$fetch.raw(url, { method, signal: AbortSignal.timeout(5000) })`.
  4. Hitung `latency = Math.round(performance.now() - startTime)`.
  5. Tangkap status code, status text, response headers, dan cuplikan data.
  6. Simpan hasil ping ke `useStorage('radar').setItem('history:' + id, pingResult)`.
  7. Return payload hasil probe ke client.

### D. Target Management (`server/api/radar/targets.*.ts`)
- **GET `/api/radar/targets`:**
  - Mengambil list target tersimpan di storage.
  - Jika kosong, lakukan inisialisasi default:
    1. `http://127.0.0.1:20128/v1/models` (allowLocal: true, name: "9Router Local Gateway")
    2. `https://api.github.com/zen` (allowLocal: false, name: "GitHub API Zen")
- **POST `/api/radar/targets`:**
  - Validasi input via Zod `{ name, url, method, allowLocal }`.
  - Simpan target baru ke storage.

### E. Ingress Webhook Collector (`server/api/webhook/[channelId].all.ts`)
- **Method:** Catch-all (`GET`, `POST`, `PUT`, dll).
- **Alur:**
  1. Ambil `channelId` dari router params.
  2. Ekstrak headers, query, dan body (menggunakan `readBody` jika ada).
  3. Simpan payload capture ke `useStorage('webhook').setItem(channelId + ':' + Date.now(), captureData)`.
  4. Return `{ success: true, channelId, captured_at: new Date().toISOString() }`.

---

## 4. Kriteria Kelulusan (DoD) Fase 1
- [ ] Semua file API terbuat dan lulus compile TypeScript.
- [ ] `npx pnpm run build` sukses tanpa error.
- [ ] Test probe manual via cURL mengembalikan status `200 OK` untuk endpoint `/api/health` dan `/api/radar/targets`.
