# Implementation Plan — Refactoring God Component & Automated Vitest Suite

## 1. Problem Statement & Konteks
Dari hasil audit mandiri terhadap codebase `api-radar`, ditemukan 2 pelanggaran standar rekayasa perangkat lunak (`Panduan.txt`):
1. **Pelanggaran Bab 3 (Arsitektur & Modularitas):** File `app/pages/index.vue` menjadi **God File** dengan ukuran membengkak mencapai **1.076 baris kode**. Seluruh komponen UI (metrik, tabel, modal, detail inspector, dan webhook viewer) tercampur aduk di satu file.
2. **Pelanggaran Bab 9 (Testing & Quality Assurance):** Belum ada automated testing runner (`vitest`) dan test suite untuk menguji logika keamanan kritis di `server/utils/ssrf.ts` (SSRF Guard).

---

## 2. Proposed Changes & Rincian Tugas

### Task 1: Pasang Vitest & Test Suite Otomatis (Bab 9)
- **Tindakan:**
  - Tambah dependensi `vitest` via `pnpm add -D vitest`.
  - Tambah script `"test": "vitest run"` di `package.json`.
  - Buat berkas uji `tests/ssrf.test.ts` untuk menguji logika `server/utils/ssrf.ts`:
    - Case 1: URL publik valid (`https://api.github.com/zen`, `https://cloudflare.com`) -> `isValid: true`.
    - Case 2: Protokol terlarang (`ftp://...`, `file:///etc/passwd`, `gopher://...`) -> `isValid: false`.
    - Case 3: Loopback (`127.0.0.1`, `localhost`, `::1`) saat `allowLocal: false` -> `isValid: false`.
    - Case 4: Private IP RFC 1918 (`10.0.0.1`, `172.16.0.1`, `192.168.1.1`) saat `allowLocal: false` -> `isValid: false`.
    - Case 5: Cloud metadata (`169.254.169.254`) -> `isValid: false`.
    - Case 6: Local Dev bypass saat `allowLocal: true` -> `isValid: true`.

### Task 2: Dekomposisi God File `app/pages/index.vue` (Bab 3)
Memecah file monolitik 1.076 baris menjadi komponen terisolasi di bawah direktori `app/components/radar/`:
1. **`app/components/radar/MetricsOverview.vue` (~50 baris):**
   - Props: `totalTargets`, `averageLatency`, `uptimeRate`, `healthyCount`.
   - Menampilkan 3 kartu metrik ringkas.
2. **`app/components/radar/TargetTable.vue` (~120 baris):**
   - Props: `targets`, `searchQuery`, `selectedTargetId`, `pingingIds`.
   - Emits: `update:searchQuery`, `ping`, `select`.
   - Menampilkan tabel endpoint bersih dan tombol aksi.
3. **`app/components/radar/TargetModal.vue` (~90 baris):**
   - Props: `modelValue` (boolean open/close).
   - Emits: `update:modelValue`, `created`.
   - Dialog modal dengan validasi Zod untuk menambah endpoint baru.
4. **`app/components/radar/ResponseDetail.vue` (~110 baris):**
   - Props: `target` (objek target terpilih), `isPinging` (boolean).
   - Emits: `ping`.
   - Menampilkan detail status, 4 stat pills, box JSON viewer, dan copy cURL.
5. **`app/components/radar/WebhookViewer.vue` (~130 baris):**
   - Komponen terpisah untuk menangani live receiver webhook ingress, pencarian log, dan inspeksi payload.
6. **Rampingkan `app/pages/index.vue` (< 90 baris):**
   - Hanya berperan sebagai *Orchestrator*: mengelola state reaktif utama, `useFetch`, `useIntervalFn`, dan merakit ke-5 komponen di atas.

### Task 3: Verifikasi Mutlak (Definition of Done)
1. `pnpm test` -> 100% test cases lolos.
2. `pnpm run lint` -> 0 error / warning.
3. `pnpm run typecheck` -> 0 error TypeScript.
4. `pnpm run build` -> Kompilasi production sukses.

---

## 3. Rencana Commit Git
- `test(ssrf): add automated vitest suite for SSRF guard logic`
- `refactor(ui): decompose index.vue god component into modular radar components`
