# PRD — API & Webhook Radar (Nuxt 3 / 4)

## 1. Problem Statement
Developer modern membutuhkan alat pemantau endpoint API internal/eksternal dan penangkap (ingress) webhook secara lokal/serverless yang ringan, real-time, zero-CORS friction, dan tanpa kewajiban konfigurasi database SQL/PostgreSQL yang rumit. API & Webhook Radar dibangun di atas Nuxt (v4 & v3) untuk menyediakan cockpit observabilitas API developer-centric dengan Nitro Engine dan Nuxt UI.

## 2. Target User
- Aji Arlando (developer harian untuk memantau gateway 9Router :20128, server VPS Singapore, dan bot Telegram).
- Mahasiswa/developer Saintek yang butuh tester API & webhook inspektur responsif.

## 3. Core Architecture
- **Framework**: Nuxt 4 (Engine v4.6 / Nitro 2.13 / Vue 3.5 / Vite 8)
- **UI Engine**: `@nuxt/ui` + Tailwind CSS (Nuxt Icon Lucide)
- **Storage Layer**: Nitro Native Storage (`unstorage:fs` di development, `unstorage:memory` fallback serverless)
- **Utilities**: `@vueuse/core`, `zod`
- **Portability**: 100% Zero-Cost Deployment ke Vercel / Cloudflare Pages / Railway

## 4. MVP Feature Scope (v1)

### Feature 1: Dynamic Outbound Ping Engine (Nitro Server Route)
- Endpoint: `POST /api/radar/ping`
- Menerima target payload: `{ id, url, method: 'GET'|'POST'|'HEAD', headers, body, allowLocal: boolean }`
- Mengukur latency round-trip (ms), menangkap status code, status text, response headers, dan response body.
- **SSRF Defense Gate**: Secara default memblokir rute IP privat/internal (RFC 1918 `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, loopback `127.0.0.1`, cloud metadata `169.254.169.254`) KECUALI jika `allowLocal === true` (khusus testing lokal Aji ke port 20128).
- Menyimpan riwayat ping ke `unstorage:radar:history`.

### Feature 2: Webhook Ingress & Catch-All Collector
- Endpoint: `ALL /api/webhook/:channelId`
- Menangkap request apa pun (method, query, headers, body, timestamp, IP).
- Menyimpan request capture ke channel spesifik di `unstorage:webhook:captures`.
- Memberikan response `200 OK` `{ success: true, captured_at: ISOString }`.

### Feature 3: Cockpit Observability Dashboard (Nuxt UI)
- Route: `/` (`app/pages/index.vue`)
- Split view / cockpit:
  - Header: System status banner, auto-refresh interval switch (5s, 10s, 30s, off), trigger "Ping All".
  - Main Table: `UTable` dengan kolom Target Name, URL, Method badge (`UBadge`), Latency badge (Hijau <200ms, Kuning <800ms, Merah >800ms), Status Dot, Last Checked, Action buttons (Ping Now, Inspect).
  - Modal Add/Edit Target: `UModal` + `UForm` dengan validasi Zod.
  - Slideover Inspection Drawer: `USlideover` di sisi kanan layar untuk membedah full response payload, status code, response headers, dan JSON tree view dengan tombol "Copy as cURL".

### Feature 4: Security & Hardening Foundation (15-Bab Panduan.txt)
- Structured error handling via `createError()` dan sanitasi PII headers (`Authorization`, `Cookie`).
- Security headers di `nuxt.config.ts`.
- Synthetic probe: `GET /api/health`.

## 5. Non-Functional Requirements
- **Performance**: Render initial load LCP < 1.0s, bundle footprint ringan.
- **Reliability**: Timeout guard `AbortSignal.timeout(5000)` pada outbound probe agar server tidak terblokir.
- **TypeScript**: 0 type errors pada `npx nuxi typecheck`.
