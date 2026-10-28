# LAPORAN KEAMANAN WEBSITE: BAGIAN IV (Panduan.txt)
**Proyek:** API & Webhook Radar  
**Tolok Ukur Standar:** Panduan.txt Seksi 13-16 (Baris 429-524), OWASP Top 10, NIST Standards  
**Status:** Baseline Specification

---

## 1. Mitigasi Server-Side Request Forgery (SSRF)

Karena aplikasi berfungsi sebagai outbound HTTP probe, celah SSRF adalah ancaman P0 (Severity: Critical).

### Aturan Guard (`server/utils/ssrf.ts`):
1. **Filter Skema URL:** Hanya mengizinkan protokol `http:` dan `https:`. Memblokir protokol berbahaya seperti `file:`, `gopher:`, `dict:`, `ftp:`.
2. **Blokir IP Privat (RFC 1918):**
   - `10.0.0.0/8`
   - `172.16.0.0/12`
   - `192.168.0.0/16`
3. **Blokir Loopback & Cloud Metadata:**
   - `127.0.0.1` / `localhost`
   - `169.254.169.254` (AWS/GCP/Azure instance metadata service).
4. **Bypass Terkendali (`allowLocal`):**
   - Hanya dibuka jika flag eksplisit `allowLocal: true` disertakan, khusus untuk developer lokal (menguji gateway 9Router port 20128).

---

## 2. Proteksi Header & Input Sanitization

1. **Security Headers (`nuxt.config.ts`):**
   - `X-Frame-Options: DENY` (Mencegah clickjacking).
   - `X-Content-Type-Options: nosniff` (Mencegah MIME type sniffing).
   - `Referrer-Policy: strict-origin-when-cross-origin`.
2. **Input Validation:**
   - Semua body payload POST divalidasi via Zod schema sebelum parsing.
