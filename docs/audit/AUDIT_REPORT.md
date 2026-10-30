# Phase 0: Full Repository Audit — API & Webhook Radar

## Current Architecture

**Stack:**
- Runtime: Nuxt 4.6.2 (compatibilityDate: 2026-06-30), Nitro engine
- UI: @nuxt/ui v4.12, Tailwind CSS v4.3, VueUse v15
- Validation: Zod v4.6.7 (digunakan di server dan client)
- Testing: Vitest v5.0.5, satu test file (tests/ssrf.test.ts)
- Package manager: pnpm 12.15.0, Node 22 (CI)

**Struktur direktori:**
```
api-radar/
├── app/                        ← Nuxt 4 App Router
│   ├── app.vue                 ← Root wrapper, navbar, meta
│   ├── pages/index.vue         ← Satu-satunya halaman (SPA)
│   └── components/radar/       ← 5 komponen domain + types.ts
├── server/
│   ├── api/health.get.ts       ← Healthcheck probe
│   ├── api/radar/              ← ping.post.ts, targets.get.ts, targets.post.ts
│   ├── api/webhook/            ← [channelId].all.ts, logs.get.ts
│   └── utils/                  ← ssrf.ts, targets.ts
├── tests/ssrf.test.ts          ← 18 test case SSRF
└── .github/workflows/ci.yml    ← pnpm install → test → lint → typecheck → build
```

**Pola arsitektur yang sudah benar:**
- Nitro `useStorage('radar')` dan `useStorage('webhook')` untuk persistensi — sesuai PRD
- `useFetch()` untuk initial data load, `$fetch()` untuk actions — sesuai anti double-fetch rule
- Semua payload divalidasi via Zod schema sebelum diproses (server side)
- `AbortSignal.timeout(5000)` pada setiap outbound ping — sesuai requirement reliability
- Header security di `nuxt.config.ts` `routeRules`: X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- CI pipeline: test → lint → typecheck → build (ordered gate)

---

## Existing Functionality

| Fitur | Status | File Utama |
|-------|--------|-----------|
| GET /api/health | ✅ Implemented | server/api/health.get.ts |
| POST /api/radar/ping | ✅ Implemented + SSRF guard | server/api/radar/ping.post.ts |
| GET /api/radar/targets | ✅ Implemented | server/api/radar/targets.get.ts |
| POST /api/radar/targets | ✅ Implemented + SSRF guard | server/api/radar/targets.post.ts |
| POST /api/webhook/:channelId | ✅ Implemented + header masking | server/api/webhook/[channelId].all.ts |
| GET /api/webhook/logs | ✅ Implemented | server/api/webhook/logs.get.ts |
| Dashboard SPA (index.vue) | ✅ Implemented | app/pages/index.vue |
| Auto-polling (5s/10s/30s/off) | ✅ Implemented | app/pages/index.vue (useIntervalFn) |
| Ping All / Ping Single | ✅ Implemented | app/pages/index.vue |
| Add Target Modal | ✅ Implemented | app/components/radar/TargetModal.vue |
| Response Drawer / Detail | ✅ Implemented | app/components/radar/ResponseDetail.vue |
| Webhook Viewer | ✅ Implemented | app/components/radar/WebhookViewer.vue |
| SSRF validator util | ✅ Implemented + 18 tests | server/utils/ssrf.ts |
| cURL Generator | ✅ Implemented | app/components/radar/types.ts generateCurl() |

---

## Critical Issues & Security Findings

---

### [SEC-001] DNS Rebinding Attack — SSRF Bypass (Severity: HIGH)
- **File:** `server/utils/ssrf.ts` (fungsi `validateTargetUrl`)
- **Confidence:** High
- **Bukti:**
  `validateTargetUrl` melakukan validasi hostname secara statik pada parse-time.
  Jika attacker mengontrol DNS record `attacker.com` yang awalnya resolve ke IP publik
  (lolos validasi), lalu TTL expire dan di-rebind ke `127.0.0.1`, request `$fetch.raw(url)`
  di `ping.post.ts` tetap dikirim ke `127.0.0.1` karena validasi tidak diulang setelah DNS resolve.
  `$fetch.raw` Node.js resolves DNS sendiri pada saat koneksi, bukan saat validasi.
- **Dampak:** Attacker dapat mengakses layanan internal di loopback (Redis, DB, internal APIs)
  melalui endpoint `/api/radar/ping` meskipun `allowLocal: false`.
- **Fix yang diperlukan (Phase 1):**
  Lakukan DNS resolve eksplisit via `dns.promises.lookup(hostname)` setelah validasi hostname,
  lalu jalankan ulang IP check terhadap hasil resolve sebelum `$fetch.raw` dipanggil.
  Pattern: resolve → check IP → fetch ke IP langsung (bukan ke hostname).

---

### [SEC-002] IPv4-mapped IPv6 Hex Notation Bypass — SSRF (Severity: HIGH)
- **File:** `server/utils/ssrf.ts` (baris `host.startsWith('::ffff:')`)
- **Confidence:** High
- **Bukti:**
  Kode hanya menangani format `::ffff:127.0.0.1` (dotted-decimal).
  WHATWG URL parser (`new URL(...)`) dapat menerima dan menormalisasi
  `http://[::ffff:7f00:1]` menjadi `[::ffff:7f00:0001]`.
  Setelah strip bracket dan slice `::ffff:`, hasilnya adalah `7f00:1` —
  bukan format dotted-decimal — sehingga ipv4Regex tidak cocok,
  dan host lolos ke `return { isValid: true }`.
- **Dampak:** Attacker dapat memasukkan `http://[::ffff:7f00:1]/` untuk menjangkau
  `127.0.0.1` tanpa terblokir.
- **Fix yang diperlukan (Phase 1):**
  Setelah `::ffff:` stripped, deteksi apakah sisa string adalah hex-pair notation
  (`high:low` dimana keduanya 4-digit hex) dan konversi ke dotted-decimal:
  `high = parseInt('7f00', 16)` → octet a=127, b=0; `low = parseInt('0001', 16)` → c=0, d=1.
  Kemudian jalankan ipv4 check standar.

---

### [SEC-003] Webhook Logs Endpoint Tanpa Autentikasi (Severity: HIGH)
- **File:** `server/api/webhook/logs.get.ts`
- **Confidence:** High
- **Bukti:**
  `GET /api/webhook/logs` adalah `defineEventHandler(async () => { ... })` tanpa
  middleware autentikasi, API key check, session check, atau IP allowlist.
  Endpoint ini mengembalikan seluruh payload webhook yang tersimpan (50 log terbaru)
  termasuk body raw dari request masuk. Header sensitif di-mask di sisi
  `[channelId].all.ts`, tetapi body payload tidak di-sanitasi sama sekali.
  Siapapun yang mengetahui URL dapat membaca semua ingress webhook.
- **Dampak:** Information disclosure: webhook body dari third-party (GitHub, Stripe, dll)
  terekspos publik. Jika body mengandung secrets (payload yang tidak masked), bocor ke publik.
- **Fix yang diperlukan (Phase 2):**
  Tambahkan minimal satu layer proteksi: shared secret header check (mis. `X-Radar-Key`)
  yang dikonfigurasikan via environment variable, atau Nuxt server-side session/cookie check.

---

### [SEC-004] Webhook Body Payload Tidak Di-Sanitasi (Severity: MEDIUM)
- **File:** `server/api/webhook/[channelId].all.ts`, `server/api/webhook/logs.get.ts`
- **Confidence:** High
- **Bukti:**
  `readBody(event)` menangkap raw body dan disimpan ke-storage as-is tanpa size limit,
  tanpa sanitasi field, dan tanpa content-type guard. Header sensitif di-mask (`SENSITIVE_HEADERS`),
  tetapi body bisa mengandung token, credential, atau PII dalam field arbitrer
  (mis. `{ "access_token": "..." }` dalam JSON body).
  Storage key pattern `channelId + ':' + Date.now()` tanpa validasi panjang channelId
  memungkinkan storage key yang sangat panjang.
- **Dampak:**
  1. Body payload dengan credential tidak terdeteksi — data PII/secrets tersimpan plain.
  2. Missing body size limit pada webhook ingress → potential memory/storage DoS.
  3. channelId tanpa sanitasi → storage key injection (mitigated oleh Nitro storage layer,
     tapi tetap best-practice violation).
- **Fix yang diperlukan (Phase 2):**
  - Tambahkan `MAX_WEBHOOK_BODY_BYTES` limit (mis. 100KB) dengan early return 413 jika exceeded.
  - Sanitasi channelId: `z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/)`.
  - Shallow-scan body JSON untuk key pattern sensitif (sama seperti header masking) — optional deep sanitization.

---

### [SEC-005] Tidak Ada Rate Limiting pada Endpoint Ping dan Webhook Ingress (Severity: MEDIUM)
- **File:** `server/api/radar/ping.post.ts`, `server/api/webhook/[channelId].all.ts`
- **Confidence:** High
- **Bukti:**
  Kedua endpoint tidak memiliki middleware rate limiting. `/api/radar/ping` merupakan
  server-side HTTP proxy — setiap request menyebabkan outbound connection. Dengan loop
  sederhana (mis. 100 req/s), attacker dapat menyebabkan resource exhaustion pada server Nitro
  dan membebani target eksternal menggunakan server ini sebagai amplifier.
  `/api/webhook/:channelId` tanpa limit memungkinkan storage flooding (Nitro filesystem storage).
- **Dampak:**
  - DoS via resource exhaustion (CPU + network pada ping).
  - Storage flooding via webhook ingress (unlimited writes).
- **Fix yang diperlukan (Phase 2):**
  Implementasikan in-process rate limiter menggunakan Nitro event hooks atau
  `useStorage('radar')` sebagai sliding window counter. Alternatif: gunakan
  `nitro-plugin-rate-limit` atau implementasi manual token bucket per IP
  dengan `getRequestIP(event, { xForwardedFor: true })`.
  Limit yang direkomendasikan: ping 60 req/min/IP, webhook 300 req/min/IP.

---

### [SEC-006] Missing Security Headers: CSP dan HSTS (Severity: LOW)
- **File:** `nuxt.config.ts` (routeRules)
- **Confidence:** High
- **Bukti:**
  `routeRules['/**'].headers` hanya memiliki 3 header:
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.
  Tidak ada `Content-Security-Policy`, `Strict-Transport-Security`,
  `Permissions-Policy`, atau `X-XSS-Protection: 0`.
- **Dampak:**
  - Tanpa CSP: tidak ada defense-in-depth terhadap XSS di WebhookViewer
    (body payload di-render di UI, potensi injection jika v-html digunakan).
  - Tanpa HSTS: koneksi awal bisa di-downgrade ke HTTP jika di-deploy ke HTTPS host.
- **Fix yang diperlukan (Phase 3):**
  Tambahkan di `nuxt.config.ts` routeRules:
  `'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"`
  `'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'`
  `'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'`
  `'X-XSS-Protection': '0'`

---

### [SEC-007] `allowLocal` Flag Dikontrol Penuh oleh Client (Severity: MEDIUM)
- **File:** `server/api/radar/ping.post.ts` dan `server/api/radar/targets.post.ts`
- **Confidence:** High
- **Bukti:**
  `PingSchema` dan `CreateTargetSchema` keduanya menerima `allowLocal: z.boolean().default(false)`
  dari request body. Artinya setiap pengguna yang dapat mengakses endpoint
  `/api/radar/ping` dapat mengirim `{ url: "http://127.0.0.1:6379", allowLocal: true }`
  dan bypass seluruh SSRF protection.
  Di PRD memang disebut `allowLocal` untuk keperluan dev (9Router gateway), tetapi tidak ada
  pembatasan agar hanya administrator/localhost yang bisa set flag ini ke `true`.
- **Dampak:** Seluruh SSRF protection dapat di-bypass oleh siapapun yang mengakses API
  tanpa autentikasi — menjadikan SEC-003 lebih serius karena pipeline ping + allowLocal
  memungkinkan full internal network scan.
- **Fix yang diperlukan (Phase 2):**
  `allowLocal: true` hanya diizinkan jika request berasal dari `127.0.0.1` (server lokal)
  atau jika ada autentikasi admin yang valid. Minimal: jika `ALLOW_LOCAL_BYPASS` env var
  tidak di-set ke `'true'`, reject `allowLocal: true` dengan 403.

---

## Technical Debt

| # | Item | Severity | File |
|---|------|----------|------|
| TD-001 | `TemplateMenu.vue` adalah sisa template Nuxt starter — berisi hardcoded external links ke Nuxt template sites, tidak relevan dengan produk | Low | app/components/TemplateMenu.vue |
| TD-002 | Status indicator "All systems healthy" di navbar adalah static string — tidak reflect kondisi aktual targets | Medium | app/app.vue |
| TD-003 | `server/api/webhook/logs.get.ts` auto-inject sample data jika storage kosong — data dummy ini tersimpan permanen di storage | Low | server/api/webhook/logs.get.ts |
| TD-004 | `app/components/radar/types.ts` mendefinisikan `newTargetSchema` hanya dengan method `GET\|POST` — sedangkan `PingSchema` di server mendukung 5 methods (GET/POST/HEAD/PUT/DELETE) — schema tidak sinkron | Medium | app/components/radar/types.ts vs server/api/radar/ping.post.ts |
| TD-005 | Target deletion endpoint tidak ada — UI tidak bisa hapus target, hanya add/upsert | High | server/api/radar/ (missing) |
| TD-006 | Tidak ada composable layer — semua state logic (`pingTarget`, `pollInterval`, `webhookLogs`) flat di `index.vue` (>150 baris script) | Low | app/pages/index.vue |
| TD-007 | `DEFAULT_TARGETS` di `server/utils/targets.ts` hardcode URL `http://127.0.0.1:20128/v1/models` — akan error di production environment selain mesin developer | Medium | server/utils/targets.ts |
| TD-008 | Tidak ada pagination di `GET /api/webhook/logs` — sliced hard-coded ke 50 item | Medium | server/api/webhook/logs.get.ts |
| TD-009 | Tidak ada `DELETE /api/radar/targets/:id` endpoint | High | server/api/radar/ (missing) |
| TD-010 | `devtools: { enabled: true }` tidak di-guard oleh env check — aktif di production build | Low | nuxt.config.ts |

---

## Prioritized Development Plan

---

### Phase 1: Critical Security Hardening (P0 — Harus sebelum deployment publik)

**Tujuan:** Tutup celah SSRF kritis agar endpoint ping tidak dapat dieksploitasi untuk internal network access.

1. **[SEC-001] DNS Rebinding fix** — `server/utils/ssrf.ts`
   - Tambahkan fungsi async `validateTargetUrlWithDNS(url, allowLocal)`.
   - Setelah validasi hostname statik lolos, panggil `dns.promises.lookup(hostname, { family: 4 })`.
   - Ambil hasil IP, jalankan ulang blok IPv4 check yang sama (loopback, RFC 1918, CGNAT, cloud metadata).
   - Jika IP private dan `allowLocal === false`, return `{ isValid: false, error: '...' }`.
   - Update `ping.post.ts` dan `targets.post.ts` untuk menggunakan fungsi async baru ini.
   - Tambahkan 3 test case di `tests/ssrf.test.ts`: mock `dns.promises.lookup` return `127.0.0.1`
     untuk hostname yang lolos statik, pastikan blocked.

2. **[SEC-002] IPv6 hex-pair notation fix** — `server/utils/ssrf.ts`
   - Setelah `host.startsWith('::ffff:')` dan slice, tambahkan check:
     jika hasil mengandung `:` (format `high:low`), parse sebagai hex:
     `const [high, low] = rest.split(':'); const a = parseInt(high, 16) >> 8; ...`
     kemudian jalankan IPv4 octet check.
   - Tambahkan 2 test case: `http://[::ffff:7f00:1]` → blocked; `http://[::ffff:c0a8:101]` → blocked (192.168.1.1).

3. **[SEC-007] Restrict `allowLocal` flag** — `server/api/radar/ping.post.ts` dan `targets.post.ts`
   - Baca env var `process.env.ALLOW_LOCAL_BYPASS`.
   - Jika `allowLocal === true` dalam request body DAN `ALLOW_LOCAL_BYPASS !== 'true'`,
     throw `createError({ statusCode: 403, statusMessage: 'allowLocal bypass tidak diizinkan di environment ini' })`.
   - Default: `ALLOW_LOCAL_BYPASS` tidak di-set = `false`.
   - Update `server/utils/targets.ts` agar `DEFAULT_TARGETS[0]` (9Router) hanya digunakan
     jika `ALLOW_LOCAL_BYPASS === 'true'`.

---

### Phase 2: Authorization & DoS Protection (P1 — Sebelum expose ke network publik)

**Tujuan:** Proteksi data webhook dari akses publik dan batasi rate abuse.

4. **[SEC-003] Auth pada webhook logs** — `server/api/webhook/logs.get.ts`
   - Baca `X-Radar-Key` header dari request.
   - Bandingkan dengan `process.env.RADAR_API_KEY` (wajib di-set; jika tidak di-set, log warning dan tolak semua request).
   - Jika tidak cocok: `createError({ statusCode: 401 })`.
   - Tambahkan header check serupa opsional di `GET /api/radar/targets`.

5. **[SEC-004] Webhook body size limit + channelId sanitasi** — `server/api/webhook/[channelId].all.ts`
   - Tambahkan konstanta `MAX_WEBHOOK_BODY_BYTES = 100 * 1024`.
   - Validasi `channelId` dengan regex `^[a-zA-Z0-9_-]{1,64}$`; jika tidak cocok, 400.
   - Setelah `readBody`, ukur serialized size: jika > limit, return 413 dengan message standar.

6. **[SEC-005] Rate limiting** — `server/api/radar/ping.post.ts` dan `server/api/webhook/[channelId].all.ts`
   - Implementasi in-memory sliding window menggunakan `Map<string, number[]>` keyed by IP.
   - Helper `checkRateLimit(ip: string, store: Map, maxReqs: number, windowMs: number): boolean`.
   - Simpan store sebagai Nitro plugin state (singleton per worker).
   - Ping: 60 req/min/IP; Webhook: 300 req/min/IP.
   - Return `createError({ statusCode: 429, statusMessage: 'Rate limit exceeded' })` jika exceeded.

---

### Phase 3: Security Headers & Hardening (P2)

**Tujuan:** Defense-in-depth, header keamanan lengkap.

7. **[SEC-006] Tambah CSP, HSTS, Permissions-Policy** — `nuxt.config.ts`
   - Di `routeRules['/**'].headers` tambahkan:
     ```
     'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"
     'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
     'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
     'X-XSS-Protection': '0'
     ```
   - Guard `devtools: { enabled: process.env.NODE_ENV !== 'production' }`.

8. **[TD-003] Remove auto-inject sample data** — `server/api/webhook/logs.get.ts`
   - Hapus blok `if (logs.length === 0) { ... await storage.setItem('demo-github-app:...') }`.
   - Return `{ logs: [] }` jika kosong — UI WebhookViewer sudah handle empty state.

9. **[TD-010] Guard devtools** — `nuxt.config.ts`
   - Ubah `devtools: { enabled: true }` menjadi `devtools: { enabled: process.env.NODE_ENV !== 'production' }`.

---

### Phase 4: API Completeness & Schema Sync (P3)

**Tujuan:** Lengkapi fungsionalitas yang hilang, sinkronisasi schema frontend-backend.

10. **[TD-005 & TD-009] Tambah DELETE endpoint target** — buat `server/api/radar/targets.delete.ts`
    - Route: `DELETE /api/radar/targets` dengan body `{ id: string }` (Nitro file-based routing
      tidak support path param cleanly untuk DELETE, gunakan query param `?id=` atau body).
    - Validasi id ada di storage; jika tidak ada, 404.
    - Filter dan re-save array targets tanpa item tersebut.
    - Update `app/pages/index.vue` dan `TargetTable.vue` untuk menampilkan tombol delete
      dengan konfirmasi, memanggil `$fetch('/api/radar/targets', { method: 'DELETE', body: { id } })`.

11. **[TD-004] Sinkronisasi method enum** — `app/components/radar/types.ts`
    - Ubah `newTargetSchema` dari `z.enum(['GET', 'POST'])` menjadi
      `z.enum(['GET', 'POST', 'HEAD', 'PUT', 'DELETE'])`.
    - Update `TargetModal.vue` dropdown method untuk include semua 5 option.

12. **[TD-002] Dynamic health status indicator** — `app/app.vue`
    - Fetch `GET /api/health` dari composable atau `useFetch` di `app.vue`.
    - Tampilkan "All systems healthy" hanya jika `status === 'ok'`;
      jika fetch gagal, tampilkan "Service degraded" dengan warna merah.

13. **[TD-008] Pagination webhook logs** — `server/api/webhook/logs.get.ts`
    - Tambahkan query param `?page=1&limit=20` menggunakan `getQuery(event)`.
    - Validasi: `page` min 1, `limit` min 1 max 100.
    - Return `{ logs, total, page, limit }`.

---

### Phase 5: Test Coverage & CI Hardening (P4)

**Tujuan:** Coverage gap tertutup, pipeline CI robust.

14. **Test untuk SEC-001 DNS rebinding fix** — `tests/ssrf.test.ts`
    - Mock `node:dns` module `promises.lookup` dengan Vitest.
    - Test: hostname valid statik tapi resolve ke `127.0.0.1` → blocked.
    - Test: hostname valid resolve ke `10.0.0.1` → blocked.
    - Test: hostname valid resolve ke `93.184.216.34` (example.com) → allowed.

15. **Test untuk SEC-002 IPv6 hex fix** — `tests/ssrf.test.ts`
    - Test: `http://[::ffff:7f00:1]` → blocked (127.0.0.1).
    - Test: `http://[::ffff:c0a8:101]` → blocked (192.168.1.1).
    - Test: `http://[::ffff:5db8:d822]` (public IP 93.184.216.34) → allowed.

16. **Test untuk rate limiting** — `tests/rate-limit.test.ts`
    - Unit test helper `checkRateLimit` dengan berbagai scenario burst.

17. **CI: tambah `pnpm audit`** — `.github/workflows/ci.yml`
    - Setelah `pnpm install`, tambahkan step `pnpm audit --audit-level=high`.
    - Ini memblokir merge jika dependency dengan high/critical vulnerability masuk.

18. **[TD-001] Hapus TemplateMenu.vue** — `app/components/TemplateMenu.vue`
    - Delete file.
    - Grep seluruh codebase untuk penggunaan `<TemplateMenu` — tidak ada penggunaan
      (component tidak diimport di mana pun berdasarkan audit); aman dihapus.

---

## Critical Files & Anchors

|File|Symbol/Region|Alasan|
|---|---|---|
|`server/utils/ssrf.ts`|`validateTargetUrl` function body, baris `if (host.startsWith('::ffff:'))`|Core SSRF perimeter; dua vulnerability (SEC-001, SEC-002) ada di sini|
|`server/api/radar/ping.post.ts`|`const ssrfCheck = validateTargetUrl(...)` dan `const res = await $fetch.raw(url, ...)`|Perlu upgrade ke async DNS-resolving validator sebelum fetch|
|`server/api/webhook/logs.get.ts`|`defineEventHandler(async () => { ... })` — tidak ada auth check|SEC-003: tidak ada auth; juga tempat auto-inject sample perlu dihapus (TD-003)|
|`server/api/webhook/[channelId].all.ts`|`let channelId = getRouterParam(...)` dan `const body = await readBody(event)`|SEC-004/SEC-005: input validation channelId dan rate limit|
|`nuxt.config.ts`|`routeRules['/**'].headers` object|SEC-006: hanya 3 header; perlu tambah 4 lagi|

---

## Verification

Setelah implementasi selesai, verifikasi dilakukan dalam urutan berikut. Semua command dijalankan dari root `D:/Projects/api-radar`.

**V1 — Unit tests pass (termasuk test baru):**
```bash
pnpm test
# Expected: 18 existing + ≥7 baru = ≥25 tests, 0 failures
```

**V2 — TypeCheck pass:**
```bash
pnpm typecheck
# Expected: exit code 0, 0 errors
```

**V3 — Build produksi bersih:**
```bash
pnpm build
# Expected: Nitro build completes, output ke .output/
```

**V4 — DNS rebinding fix aktif (smoke test manual):**
Jalankan dev server: `pnpm dev`
```bash
curl -X POST http://localhost:3000/api/radar/ping \
  -H 'Content-Type: application/json' \
  -d '{"url":"http://localtest.me","allowLocal":false}'
# Expected: 403 {"statusCode":403,"statusMessage":"SSRF Protection: Target IP/Host diblokir"}
# (localtest.me resolves ke 127.0.0.1 — harus diblokir setelah DNS resolve check)
```

**V5 — allowLocal env guard aktif:**
```bash
# Tanpa env var (default):
curl -X POST http://localhost:3000/api/radar/ping \
  -H 'Content-Type: application/json' \
  -d '{"url":"http://127.0.0.1:6379","allowLocal":true}'
# Expected: 403

# Dengan env var:
ALLOW_LOCAL_BYPASS=true pnpm dev
curl -X POST http://localhost:3000/api/radar/ping \
  -H 'Content-Type: application/json' \
  -d '{"url":"http://127.0.0.1:20128/v1/models","allowLocal":true}'
# Expected: 200 (atau 502 jika port tidak aktif, bukan 403)
```

**V6 — Webhook logs auth:**
```bash
# Tanpa key:
curl http://localhost:3000/api/webhook/logs
# Expected: 401

# Dengan key:
curl -H 'X-Radar-Key: test-secret' http://localhost:3000/api/webhook/logs
# Expected: 200 { logs: [...] }
```

**V7 — Rate limiting (ping):**
```bash
for i in $(seq 1 65); do \
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3000/api/radar/ping \
    -H 'Content-Type: application/json' \
    -d '{"url":"https://api.github.com/zen"}'; \
done
# Expected: pertama 60 request → 200, request ke-61+ → 429
```

**V8 — Security headers:**
```bash
curl -I http://localhost:3000/
# Expected: headers Content-Security-Policy, Strict-Transport-Security,
#           Permissions-Policy, X-Content-Type-Options, X-Frame-Options, Referrer-Policy
```

---

## Assumptions & Contingencies

- **ALLOW_LOCAL_BYPASS env var**: Implementer gunakan `process.env.ALLOW_LOCAL_BYPASS` langsung tanpa `runtimeConfig` agar tersedia di Nitro server routes tanpa perubahan nuxt.config. Jika project nanti pindah ke Nuxt `runtimeConfig.allowLocalBypass`, lakukan migrasi saat itu.
- **RADAR_API_KEY env var**: Jika di-set kosong string (`''`), perlakukan sebagai tidak di-set → reject semua request ke `/api/webhook/logs` dengan error log "RADAR_API_KEY not configured". Jangan izinkan bypass dengan empty key.
- **Rate limiter storage**: Gunakan modul-level `Map` (in-memory, per Nitro worker). Jika Nitro dijalankan multi-worker (cluster mode), rate limit tidak shared antar worker — acceptable tradeoff untuk fase ini; cukup dicatat di komentar kode.
- **DNS lookup di ssrf.ts**: Import `node:dns` langsung (`import { promises as dnsPromises } from 'node:dns'`). Nitro/Node 22 mendukung ini tanpa polyfill. Jika DNS lookup timeout (default Node 5s), tangkap error dan return `{ isValid: false, error: 'DNS resolution failed' }` — fail closed, bukan fail open.
- **DELETE target endpoint routing**: Nitro file-based routing untuk DELETE dengan ID menggunakan query param `DELETE /api/radar/targets?id=xxx` karena `server/api/radar/targets.delete.ts` tanpa dynamic segment. Alternatif `server/api/radar/targets/[id].delete.ts` jika implementer prefer REST-style path param — keduanya valid, pilih mana yang lebih konsisten dengan existing pattern (existing tidak ada dynamic segment, jadi gunakan query param).
