# Spesifikasi Teknis: Fase 3 — Hardening & Quality Gate (15-Bab Panduan.txt)

## 1. Tujuan Fase
Melakukan audit komprehensif terhadap codebase yang telah dibangun mengacu pada standar 15 Bab `Panduan.txt` dan SOP `web-fullstack-hardening-audit` untuk memastikan sistem tidak memiliki celah keamanan, bebas memory leak, dan production ready.

---

## 2. Checklist Audit & Hardening Mandatori

### A. Bab 4: Keamanan Website & OWASP
- [ ] **SSRF Verification**: Menguji bahwa request ke IP privat seperti `192.168.1.1` atau `169.254.169.254` langsung ditolak dengan status HTTP 403 Forbidden jika `allowLocal === false`.
- [ ] **Header Sanitization**: Header sensitif (`Authorization`, `Cookie`, `X-Api-Key`) disensor (`***MASKED***`) sebelum dicatat ke storage log riwayat.
- [ ] **Security Headers**: Konfigurasi `X-Content-Type-Options: nosniff` dan `X-Frame-Options: DENY` aktif di `nuxt.config.ts`.

### B. Bab 5 & 8: Performance & Reliability
- [ ] **Timeout Guard**: Outbound probe wajib memiliki timeout mutlak (`AbortSignal.timeout(5000)`) agar server Nitro tidak hang jika endpoint target lambat atau down.
- [ ] **Zero Double-Fetch**: Initial load menggunakan composable `useFetch`, mutasi action menggunakan `$fetch`.
- [ ] **SSR Hydration Check**: Memastikan tidak ada perbedaan render antara server HTML dan client DOM (tidak menggunakan `window` di setup tanpa guard `import.meta.client`).

### C. Bab 9: Testing & Quality Gate
- [ ] **Typecheck**: Menjalankan `npx pnpm run typecheck` dengan hasil 0 error.
- [ ] **Linting**: Menjalankan `npx pnpm run lint` dengan hasil 0 warning dan 0 error.
- [ ] **Production Build**: Menjalankan `npx pnpm run build` dan memastikan output bundle Nitro ter-generate utuh di `.output/`.

### D. Bab 11: Monitoring & Observability
- [ ] Route `GET /api/health` merespons secara deterministik untuk pemantauan eksternal (uptime monitoring).

---

## 3. Kriteria Kelulusan (DoD) Fase 3
- [ ] Seluruh butir audit di atas berstatus centang (PASS).
- [ ] Sistem siap diuji coba secara live untuk memantau 9Router lokal dan target API eksternal.
