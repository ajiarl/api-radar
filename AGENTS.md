# AGENTS.md — Development Mandate for OMP & Dev Agents

## Project Context
Project: **API & Webhook Radar**
Stack: **Nuxt 4 / Nuxt 3 (v4.6.2), Nitro Engine (v2.13.4), Vue 3.5 `<script setup>`, @nuxt/ui, Tailwind CSS, @vueuse/core, Zod**
Role: Fullstack Developer Tool untuk monitoring latency endpoint dan ingress webhook collector.

## Engineering Standard: 15-Chapter Panduan.txt (SOP Web Fullstack Hardening)
Setiap task wajib mematuhi standar hardening 15 Bab (`docs/audit/` framework):
1. **Perencanaan & Scope**: Ikuti `PRD.md` dan `DESIGN.md`. Pantang menambah dependensi raksasa tanpa izin.
2. **UI/UX & Aksesibilitas**: Desain cockpit high-density, contrast ratio lolos WCAG 2.2 AA, focus ring jelas, zero blocking `alert()`.
3. **Arsitektur Nitro**:
   - Backend routes di `server/api/`. Gunakan `defineEventHandler`, `readBody`, `getQuery`, dan `createError`.
   - Gunakan Nitro Storage (`useStorage('radar')` / `useStorage('webhook')`).
   - Anti Double-Fetch: `useFetch()` / `useAsyncData()` untuk initial load, `$fetch()` untuk actions/events.
   - Variabel state harus SSR-safe: gunakan `useState('key', () => defaultVal)`.
4. **Keamanan & OWASP**:
   - **Anti-SSRF Protection**: Di `server/api/radar/ping.post.ts`, validasi target hostname/IP. Blokir loopback/privat/cloud metadata kecuali flag `allowLocal: true`.
   - **Input Validation**: Validasi semua payload masuk menggunakan Zod schema sebelum diproses.
   - **Data Sanitization**: Masking header sensitif (`Authorization`, `Cookie`, `X-Api-Key`) pada log storage.
5. **Reliability & Timeouts**:
   - Selalu sertakan timeout eksplisit `AbortSignal.timeout(5000)` pada outbound ping agar server tidak hang.
   - Sediakan synthetic probe `GET /api/health` yang mengembalikan `{ status: 'ok', uptime, timestamp }`.

## Definition of Done (DoD) per Task:
- [ ] Code terstruktur rapi di `server/api/` dan `app/pages/`, `app/components/`
- [ ] `npx nuxi typecheck` exits with code 0 (0 error)
- [ ] `npx nuxi build` exits cleanly (production ready)
- [ ] Tidak ada data dummy halusinasi yang merusak sistem

## Implementation Plan for OMP:

### Phase 1: Backend Nitro API & Storage (P0)
1. `server/utils/ssrf.ts`: Helper fungsi untuk memvalidasi URL (blokir IP privat kecuali `allowLocal === true`).
2. `server/api/health.get.ts`: Healthcheck synthetic probe route.
3. `server/api/radar/ping.post.ts`: Endpoint utama untuk ping single target URL via Nitro `$fetch.raw` dengan timeout 5s, tangkap status, latency, headers, dan simpan log ke Nitro `useStorage('radar')`.
4. `server/api/radar/targets.get.ts` & `targets.post.ts`: CRUD daftar endpoint target monitoring tersimpan.
5. `server/api/webhook/[channelId].all.ts`: Ingress collector untuk menangkap request apa pun dan menyimpannya ke `useStorage('webhook')`.

### Phase 2: Frontend Cockpit UI (P1)
1. `app/pages/index.vue`:
   - Header bar: Title, status indicator, switch auto-refresh interval (5s, 10s, 30s, off), tombol "Ping All".
   - Target List via `UTable`: Name, URL, Method badge, Latency badge, Status dot, Actions (Ping Now, Inspect).
   - Modal Add Target: `UModal` + `UForm` + Zod schema untuk mendaftarkan endpoint baru.
   - Slideover Drawer: `USlideover` untuk bedah payload (status, latency, timing, response body, cURL generator).

### Phase 3: Verification & Hardening (P2)
1. Verifikasi live ping ke local gateway 9Router (`http://127.0.0.1:20128/v1/models` dengan flag `allowLocal: true`).
2. Typecheck dan build check.
