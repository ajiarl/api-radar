# LAPORAN TESTING DAN QUALITY ASSURANCE: BAGIAN IX (Panduan.txt)
**Proyek:** API & Webhook Radar  
**Tolok Ukur Standar:** Panduan.txt Seksi 33-36 (Baris 796-861), Testing Pyramid & Strict Quality Gates  
**Status:** Baseline Specification

---

## 1. Quality Gates Pipeline

Sebelum sebuah fase dinyatakan selesai, seluruh rangkaian perintah verifikasi ini wajib dieksekusi:

```bash
# 1. Automated Unit Tests (Vitest)
pnpm test

# 2. Typecheck Strict
npx pnpm run typecheck

# 3. Linter Strict
npx pnpm run lint

# 4. Production Build
npx pnpm run build
```

Kriteria lulus mutlak: Exit code 0, 19/19 Vitest unit tests passed, 0 error TypeScript, 0 warning ESLint, dan build Nitro server bundle ter-generate sukses.

---

## 2. Automated Test Suite Matrix (`tests/ssrf.test.ts`)
1. **Public URL Validation:** `https://api.github.com/zen`, `https://cloudflare.com` -> Valid (`isValid: true`).
2. **Illegal Protocols Block:** `file:///etc/passwd`, `ftp://`, `gopher://` -> Blocked (`isValid: false`).
3. **RFC 1918 Private IP Block:** `10.0.0.1`, `172.16.0.1`, `192.168.1.1` saat `allowLocal: false` -> Blocked.
4. **Loopback & Cloud Metadata Block:** `127.0.0.1`, `localhost`, `169.254.169.254` saat `allowLocal: false` -> Blocked.
5. **Local Dev Controlled Bypass:** `http://127.0.0.1:20128/api/auth/status` saat `allowLocal: true` -> Allowed (`isValid: true`).

---

## 3. Test Matrix Verifikasi Manual

1. **Test Probe SSRF:** Kirim `POST /api/radar/ping` dengan url `http://192.168.1.1` tanpa `allowLocal`. Pastikan server menolak dengan HTTP 403.
2. **Test Probe 9Router Lokal:** Kirim `POST /api/radar/ping` dengan url `http://127.0.0.1:20128/v1/models` dan `allowLocal: true`. Pastikan server mengembalikan HTTP 200 dan latensi < 30ms.
3. **Test Webhook Ingress:** Kirim `POST /api/webhook/channel-test` dengan payload JSON. Pastikan tersimpan dan bisa ditarik kembali.
