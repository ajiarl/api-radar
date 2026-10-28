# Spesifikasi Teknis: Fase 2 — Frontend Cockpit Dashboard

## 1. Tujuan Fase
Mengimplementasikan user interface dashboard Nuxt 4 yang bersih, lega, dan elegan sesuai template acuan Superdesign yang telah disetujui (https://p.superdesign.dev/draft/e98c2471-2790-43b8-9b9c-d72f853f0f6d) menggunakan komponen resmi `@nuxt/ui` dan Tailwind CSS.

---

## 2. Struktur File yang Dibangun

```text
app/
├── app.vue                     # Layout wrapper utama (Navbar, Toast Provider)
└── pages/
    └── index.vue               # Dashboard cockpit terpusat (max-w-6xl)
```

---

## 3. Komponen & Fitur Interaktif

### A. Simple Top Navbar
- Brand Logo `API Radar` dengan icon `<UIcon name="i-lucide-activity" />`.
- Status pill di pojok kanan: "All systems healthy" dengan dot hijau berkedip.
- Link navigasi: `Endpoints`, `Webhooks`, `History Logs`.

### B. Summary Metric Cards (3 Kartu Saja)
- **Kartu 1:** Total Endpoint (misal: "5 Target", subteks: "Dipantau berkala").
- **Kartu 2:** Rata-rata Latensi (misal: "42.4 ms" warna emerald).
- **Kartu 3:** Tingkat Uptime (misal: "100%", subteks: "0 kegagalan 24 jam terakhir").

### C. Main Data Table (`UTable`)
- Menampilkan data dari `useFetch('/api/radar/targets')`.
- Kolom:
  1. **Status**: Badge bulat hijau (`200 OK`) atau merah/kuning.
  2. **Nama & URL**: Nama tebal, URL monospace abu-abu.
  3. **Method**: Badge `GET` (abu-abu/sky) atau `POST` (purple).
  4. **Latensi**: Angka ms monospace hijau tebal.
  5. **Terakhir Dicek**: Timestamp human-readable (misal: "2 detik lalu").
  6. **Aksi**:
     - Tombol `Ping`: Memicu `$fetch('/api/radar/ping')` secara on-demand, memperbarui row tersebut.
     - Tombol `Detail`: Membuka panel inspeksi response.

### D. Modal Tambah Endpoint (`UModal` + `UForm`)
- Trigger via tombol "+ Tambah Endpoint" di header.
- Form inputs:
  - Nama Endpoint (text)
  - Target URL (url, validasi wajib format valid)
  - HTTP Method (`GET` atau `POST`)
  - Checkbox `Izinkan IP Lokal / Dev` (`allowLocal`)
- Validasi Zod schema pra-submit.
- Saat sukses, panggil `refresh()` data tabel dan munculkan toast notifikasi sukses.

### E. Card Detail / Inspector (Sesuai Desain Acuan)
- Card bersih di bawah tabel untuk menampilkan hasil respons endpoint yang sedang dipilih:
  - Status Code badge besar (`200 OK`)
  - Total Latensi (`18.4 ms`)
  - Content-Type (`application/json`)
  - Payload Size (`1.24 KB`)
  - Box JSON Viewer gelap dengan syntax highlighting sederhana dan tombol "Copy cURL".

---

## 4. Kriteria Kelulusan (DoD) Fase 2
- [ ] Tampilan halaman `/` identik secara proporsi dan rasa bersihnya dengan draft Superdesign.
- [ ] Fitur ping individu dan ping semua berfungsi memicu request ke Nitro API.
- [ ] Modal penambahan target berhasil menambah data ke storage.
- [ ] `npx nuxi build` tetap sukses 100%.
