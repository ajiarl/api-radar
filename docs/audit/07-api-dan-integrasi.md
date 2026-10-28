# LAPORAN API DAN INTEGRASI: BAGIAN VII (Panduan.txt)
**Proyek:** API & Webhook Radar  
**Tolok Ukur Standar:** Panduan.txt Seksi 25-28 (Baris 650-723), RESTful Standards & RFC 9110  
**Status:** Baseline Specification

---

## 1. Spesifikasi REST API (Nitro Event Handlers)

| Route Path | Method | Fungsi | Request Body | Response Output |
|---|---|---|---|---|
| `/api/health` | `GET` | Probe status service | - | `{ status: 'ok', uptime, timestamp }` |
| `/api/radar/ping` | `POST` | Trigger outbound probe | `{ id, url, method, allowLocal }` | `{ status, latencyMs, headers, body }` |
| `/api/radar/targets` | `GET` | List target terdaftar | - | `{ targets: [...] }` |
| `/api/radar/targets` | `POST` | Tambah target baru | `{ name, url, method, allowLocal }` | `{ success: true, target }` |
| `/api/webhook/:id` | `ALL` | Ingress webhook | Bebas (JSON/Form/Raw) | `{ success: true, channelId, captured_at }` |

---

## 2. Standar Error Handling (RFC 7807)
Error dikembalikan menggunakan helper Nitro `createError()`:
- `400 Bad Request`: Format URL tidak valid atau parameter wajib hilang.
- `403 Forbidden`: Deteksi SSRF mencoba mengakses IP privat tanpa `allowLocal: true`.
- `504 Gateway Timeout`: Probe target melebihi batas waktu 5000ms.
